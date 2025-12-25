import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { World } from '@/lib/models';

export async function POST() {
  await connectDB();
  
  try {
    // 1. 清空所有数据
    await World.deleteMany({});
    
    // 2. 这里不需要手动创建新世界，因为当 delete 成功后，
    // 前端会自动刷新，下一次 tick 接口被调用时，
    // tick 接口内部的检测逻辑会自动发现没有世界，从而触发“创世纪”逻辑。
    // 这样可以避免重复代码。
    
    return NextResponse.json({ success: true, message: "世界已重置" });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}