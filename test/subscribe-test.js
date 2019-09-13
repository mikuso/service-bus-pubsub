const PubSubClient = require('..');

async function main() {

    const client = new PubSubClient({
        connectionString: process.env.CONNSTR,
    });

    const sub = client.subscribe(process.env.TOPIC_NAME, process.env.SUBSCRIPTION_NAME);

    sub.on('warning', err => {
        console.log('WARNING', err);
    });

    sub.on('closed', () => {
        console.log('subscription closed');
    });

    sub.on('message', msg => {
        console.log('incoming message', msg.body);
        msg.complete();
    });

    function close() {
        sub.stop();
        client.close();
    }

    process.on('SIGINT', close);
    process.on('SIGTERM', close);

}
main();
