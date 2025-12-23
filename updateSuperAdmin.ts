
import mongoose from 'mongoose';
import { User } from './src/models/user.model';
import { env } from './src/lib/env';
import dotenv from 'dotenv';

dotenv.config();

const updateSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/startease');
        console.log('Connected to MongoDB');

        const email = 'hi@starteaseai.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User with email ${email} not found.`);
            process.exit(1);
        }

        user.role = 'superadmin';
        await user.save();

        console.log(`Successfully updated ${email} to superadmin role.`);
        console.log('User details:', {
            email: user.email,
            role: user.role,
            isAdmin: user.isAdmin,
            isSuperAdmin: user.isSuperAdmin
        });

    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

updateSuperAdmin();
