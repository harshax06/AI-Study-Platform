// Script to clear all user data from the database
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Task = require('./models/Task');
const Score = require('./models/Score');
const Notification = require('./models/Notification');

const clearDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Delete all records
        const userResult = await User.deleteMany({});
        const taskResult = await Task.deleteMany({});
        const scoreResult = await Score.deleteMany({});
        const notificationResult = await Notification.deleteMany({});

        console.log('\n🗑️  Database Cleared:');
        console.log(`   - Users deleted: ${userResult.deletedCount}`);
        console.log(`   - Tasks deleted: ${taskResult.deletedCount}`);
        console.log(`   - Scores deleted: ${scoreResult.deletedCount}`);
        console.log(`   - Notifications deleted: ${notificationResult.deletedCount}`);
        console.log('\n✅ Database is now empty and ready for fresh testing!\n');

        // Close connection
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error clearing database:', err);
        process.exit(1);
    }
};

clearDatabase();
