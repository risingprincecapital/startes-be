import mongoose from 'mongoose';
import { User } from '../models/user.model';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migration script to update existing users with new fields
 * Run this script after deploying the updated User model
 */
async function migrateUsers() {
    try {
        console.log('Starting user migration...');

        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        // Update all existing users to have authProvider = 'email'
        const result = await User.updateMany(
            { authProvider: { $exists: false } },
            {
                $set: {
                    authProvider: 'email'
                }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} users with authProvider='email'`);

        // Count users by auth provider
        const emailUsers = await User.countDocuments({ authProvider: 'email' });
        const googleUsers = await User.countDocuments({ authProvider: 'google' });

        console.log('\nUser Statistics:');
        console.log(`  Email users: ${emailUsers}`);
        console.log(`  Google users: ${googleUsers}`);
        console.log(`  Total users: ${emailUsers + googleUsers}`);

        await mongoose.disconnect();
        console.log('\n✅ Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateUsers();
