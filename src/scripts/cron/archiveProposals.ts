import { connectToDatabase } from '@/lib/mongodb'; // Adjust path as needed
import { Proposal } from '@/models/Proposal';     // Adjust path as needed
import mongoose from 'mongoose';

async function archiveOldProposals() {
  console.log('Starting proposal archiving job...');
  let connection;
  try {
    // Ensure a direct Mongoose connection if not using the existing helper's cached connection model
    // The helper connectToDatabase() might be designed for API routes and could reuse connections differently.
    // For a script, a more direct Mongoose connect might be robust.
    if (mongoose.connection.readyState !== 1) {
      console.log('No existing Mongoose connection, attempting to connect...');
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set.');
      }
      connection = await mongoose.connect(process.env.MONGODB_URI);
      console.log('Mongoose connected successfully for cron job.');
    } else {
      console.log('Using existing Mongoose connection.');
    }
    // If connectToDatabase is a Mongoose connection wrapper, it could be used directly too.
    // For this example, using direct mongoose.connect for clarity in a script context.
    // await connectToDatabase(); // Alternative if this function establishes a global Mongoose connection

    const now = new Date();
    const result = await Proposal.updateMany(
      {
        status: 'active',
        epochEnd: { $lt: now },
      },
      {
        $set: { status: 'archived' },
      }
    );

    console.log(`Proposal archiving job finished. Archived ${result.modifiedCount} proposals.`);

  } catch (error) {
    console.error('Error during proposal archiving job:', error);
    process.exitCode = 1; // Indicate failure to the cron runner
  } finally {
    // If we opened a new connection specifically for this script, close it.
    // If using a shared connection pool (like from connectToDatabase typically does), 
    // avoid closing it here as it might affect other parts of a running application.
    if (connection) {
        await mongoose.disconnect();
        console.log('Mongoose connection closed for cron job.');
    }
    // If not directly managing connection, ensure script can exit, or Mongoose handles it.
  }
}

// Execute the function if the script is run directly
if (require.main === module) {
  archiveOldProposals()
    .then(() => {
      console.log('Cron job execution successful.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Cron job execution failed:', err);
      process.exit(1);
    });
}

export default archiveOldProposals; // Export for potential programmatic use or testing 