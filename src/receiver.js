const {ServiceBusClient, ReceiveMode} = require('@azure/service-bus');
const EventEmitter = require('eventemitter3');
const PromiseQueue = require('promise-queue');
const {FibonacciBackoff} = require('simple-backoff');
const {
    TimeoutOverrunError,
    AbortError,
} = require('./errors');

function noop(){}
async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

class Receiver extends EventEmitter {
    constructor({subscriptionClient, maxConcurrency = 1, idleTimeoutSeconds = 5}) {
        super();
        this.subscriptionClient = subscriptionClient;
        this.maxConcurrency = maxConcurrency;
        this.idleTimeoutSeconds = idleTimeoutSeconds;

        this._backoff = new FibonacciBackoff({
            min: 2000,
            max: 60000
        });

        this._queue = new PromiseQueue(1, Infinity);
        this._abort = noop;
        this._idle = true;
    }

    async start() {
        return this._queue.add(()=>{
            if (!this._idle) {
                return;
            }

            this._idle = false;
            this.emit('started');

            this._abort = undefined;
            this._aborted = new Promise((r,x) => this._abort = ()=>x(new AbortError()));

            this.loop().then(() => {
                this._idle = true;
                this.emit('stopped');
            });

            return delay(2000);
        });
    }

    async stop() {
        return this._queue.add(()=>{
            if (this._idle) {
                return;
            }
            const stopped = new Promise(r => this.once('stopped', r));
            this._abort();
            return stopped.then(()=>delay(2000));
        });
    }

    async loop() {
        let receiver = this.subscriptionClient.createReceiver(ReceiveMode.PeekLock);

        while (true) {
            try {
                let msgs = await Promise.race([
                    receiver.receiveMessages(this.maxConcurrency, this.idleTimeoutSeconds),
                    new Promise((r,x) => setTimeout(()=>x(new TimeoutOverrunError()), (this.idleTimeoutSeconds*1000) + 1000)),
                    this._aborted
                ]);

                msgs.forEach(m => this.emit('message', m));
                this._backoff.reset();

            } catch (err) {

                if (err instanceof AbortError) {
                    await receiver.close();
                    break;
                }

                this.emit('warning', err);
                if (err instanceof TimeoutOverrunError || receiver.isClosed) {
                    await receiver.close();
                    receiver = this.subscriptionClient.createReceiver(ReceiveMode.PeekLock);
                }

                // else, a retryable error?
                const ms = this._backoff.next();
                await delay(ms);
            }
        }
    }
}

module.exports = Receiver;
