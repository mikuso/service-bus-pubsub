const {ServiceBusClient, ReceiveMode} = require('@azure/service-bus');
const uuid = require('uuid');
const EventEmitter = require('eventemitter3');
const Receiver = require('./receiver');
const Sender = require('./sender');
const {TimeoutError} = require('./errors');

const DEFAULT_TTL = 1000*30;

class PubSubClient extends EventEmitter {
    constructor({connectionString}) {
        super();
        this.client = ServiceBusClient.createFromConnectionString(connectionString);
    }

    subscribe(topicName, subscriptionName) {
        const subscriptionClient = this.client.createSubscriptionClient(topicName, subscriptionName);
        const receiver = new Receiver({subscriptionClient});
        receiver.start();
        return receiver;
    }

    createPublisher(topicName) {
        const topicClient = this.client.createTopicClient(topicName);
        return new Sender({topicClient});
    }

    async close() {
        await this.client.close();
        this.emit('closed');
        this.removeAllListeners();
    }
}

module.exports = PubSubClient;
