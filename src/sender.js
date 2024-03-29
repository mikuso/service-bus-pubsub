const EventEmitter = require('eventemitter3');

class Receiver extends EventEmitter {
    constructor({topicClient}) {
        super();
        this._topicClient = topicClient;
        this._sender = this._topicClient.createSender();
        this._messagesPendingSend = [];
        this._offloading = false;
    }

    send(msg) {
        let resolve;
        const complete = new Promise(r => resolve = r);
        this._messagesPendingSend.push({
            content: msg,
            resolve
        });
        this._offloadMessages();
        return complete;
    }

    async _offloadMessages(continuation) {
        if (this._offloading && !continuation) {
            return;
        }
        this._offloading = true;

        while (this._messagesPendingSend.length > 0) {
            let nextMsg = this._messagesPendingSend.shift();
            try {
                await this._sender.send(nextMsg.content);
                nextMsg.resolve();
            } catch (err) {
                this.emit('warning', err);
                // add the message back to the front of the queue
                this._messagesPendingSend.unshift(nextMsg);
                setTimeout(() => {
                    this._offloadMessages(true);
                }, 1000*60);
                return;
            }
        }

        this._offloading = false;
    }
}

module.exports = Receiver;
