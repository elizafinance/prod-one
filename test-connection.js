import { config } from 'dotenv';
config({ path: '.env.local' });

console.log('Environment loaded:');
console.log('RABBITMQ_URL:', process.env.RABBITMQ_URL ? 'LOADED' : 'MISSING');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'LOADED' : 'MISSING');
console.log('REDIS_URL:', process.env.REDIS_URL ? 'LOADED' : 'MISSING');

import { rabbitmqService } from './src/services/rabbitmq.service.js';

async function testConnections() {
  try {
    console.log('\n🧪 Testing RabbitMQ connection...');
    await rabbitmqService.connect();
    console.log('✅ RabbitMQ connection successful!');
    
    const channel = await rabbitmqService.getChannel();
    if (channel) {
      console.log('✅ RabbitMQ channel created successfully!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnections(); 