const PubSubClient = require('..');

async function main() {

    const client = new PubSubClient({
        connectionString: process.env.CONNSTR,
    });

    const pub = client.createPublisher(process.env.TOPIC_NAME);

    pub.on('warning', err => {
        console.log('WARNING', err);
    });
    pub.on('closed', () => {
        console.log('client closed');
    });

    try {
        await pub.send({
            body: {
                test: 123
            },
            timeToLive: 10*1000
        });
    } catch (err) {
        console.log(`test err`, err);
    } finally {
        await client.close();
        console.log('closed');
    }

}
main();
