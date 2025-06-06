import amqp from 'amqplib';
import { rabbitmqConfig } from '../config/rabbitmq.config.js';

let connection = null;
let channel = null;

async function connectRabbitMQ() {
  if (connection && channel) {
    return { connection, channel };
  }

  try {
    console.log('Attempting to connect to RabbitMQ...');
    connection = await amqp.connect(rabbitmqConfig.url);
    console.log('Successfully connected to RabbitMQ!');

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
      // Implement more robust reconnection logic here
      connection = null;
      channel = null;
    });

    connection.on('close', () => {
      console.warn('RabbitMQ connection closed.');
      // Implement reconnection logic here
      connection = null;
      channel = null;
    });

    channel = await connection.createChannel();
    console.log('RabbitMQ channel created.');

    // Assert exchanges to ensure they exist
    await channel.assertExchange(rabbitmqConfig.eventsExchange, 'topic', { durable: true });
    console.log(`Exchange '${rabbitmqConfig.eventsExchange}' asserted.`);
    await channel.assertExchange(rabbitmqConfig.questProgressExchange, 'fanout', { durable: true });
    console.log(`Exchange '${rabbitmqConfig.questProgressExchange}' asserted.`);

    return { connection, channel };
  } catch (error) {
    console.error('Failed to connect to RabbitMQ or create channel:', error);
    // Implement retry logic or throw error to be handled by application startup
    throw error;
  }
}

async function getChannel() {
  if (!channel) {
    await connectRabbitMQ();
  }
  return channel;
}

async function publishToExchange(exchangeName, routingKey, message) {
  try {
    const ch = await getChannel();
    const messageBuffer = Buffer.from(JSON.stringify(message));
    ch.publish(exchangeName, routingKey, messageBuffer);
    console.log(`Message published to exchange '${exchangeName}' with routing key '${routingKey}':`, message);
  } catch (error) {
    console.error('Failed to publish message to RabbitMQ:', error);
    // Handle publish error (e.g., retry, log to dead-letter queue)
  }
}

export const rabbitmqService = {
  connect: connectRabbitMQ,
  getChannel,
  publishToExchange,
}; 