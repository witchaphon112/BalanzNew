require('dotenv').config();
const mongoose = require('mongoose');
(async()=>{
  try{
    await mongoose.connect(process.env.MONGODB_URI, {serverSelectionTimeoutMS:10000});
    const {Transaction} = require('../models');
    
    const oldUserId = '697dd848627df78b5f14d7ca';  // user with lineUserId U2e48d1af...
    const newUserId = '697de48e7b8cb2ef2f7ddc76';  // Witchaphon y. with lineUserId U491b74...
    
    const result = await Transaction.updateMany(
      { userId: oldUserId },
      { $set: { userId: newUserId } }
    );
    
    console.log(`Moved ${result.modifiedCount} transactions from ${oldUserId} to ${newUserId}`);
    console.log('All LINE transactions are now linked to your web account (Witchaphon y.)');
  }catch(e){ 
    console.error('Error:', e.message); 
  }
  finally{ 
    await mongoose.disconnect(); 
  }
})();
