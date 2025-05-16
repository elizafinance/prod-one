import { redisService } from './src/services/redis.service.js';
import { redisConfig } from './src/config/redis.config.js';

async function testRedisConnection() {
  try {
    console.log('Testing Redis connection...');
    console.log('Redis URL:', redisConfig.url);
    
    const client = await redisService.connect();
    console.log('Redis connection successful!');
    
    // Test setting a value
    await redisService.set('test-key', 'test-value');
    console.log('Successfully set test value');
    
    // Test getting the value
    const value = await redisService.get('test-key');
    console.log('Retrieved value:', value);
    
    // Clean up
    await redisService.del('test-key');
    console.log('Test completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('Redis connection test failed:', error);
    process.exit(1);
  }
}

testRedisConnection(); 