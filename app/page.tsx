'use client';
import { useState, useEffect, useRef } from 'react';

// 类型定义更新
type Agent = {
  id: number;
  name: string;
  job: string;
  gender: string;
  hp: number;
  hunger: number;
  inventory: string[];
  locationName: string; // 新增地名
  actionLog: string;    // 新增动作摘要
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState({
    weather: "未知",
    time: "未知",
    desc: "正在扫描周边环境...",
    day: 1
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 核心循环
  useEffect(() => {
    const fetchData = async () => {
       if (loading) return;
       setLoading(true);
       try {
         const res = await fetch('/api/tick', { method: 'POST' });
         // 这里建议单独写一个 GET 接口拉取全量状态，
         // 但为了演示方便，我们假设 POST 返回所有最新状态
         // 实际项目中请修改 API 返回 world 对象
         
         // 临时：我们需要手动去 fetch 状态，或者让 POST 返回更多数据
         // 这里我假设你已经修改了 route.js 的返回，或者我们再发一个 GET
         // 为了简单，我们只从 fetch('/api/tick') 的返回里拿 log，
         // 但理想情况是建立一个 GET /api/state 接口。
         // *** 此处假设你已经根据上一步修改了 route.js 返回 world 对象 ***
         // 如果没改，你需要再写一个 GET 接口。
         
         // 假设 route.js 最后一行改成：
         // return NextResponse.json({ success: true, world }); 
         // 下面是基于这个假设的前端代码：
         
         const data = await res.json();
         if (data.success && data.world) {
           setLogs(data.world.logs);
           setAgents(data.world.agents);
           setEnvInfo({
             weather: data.world.weather,
             time: data.world.timeOfDay,
             desc: data.world.envDescription,
             day: Math.floor((data.world.turn - 1) / 6) + 1
           });
         }
       } catch (e) {
         console.error(e);
       } finally {
         setLoading(false);
       }
    };

    // 首次加载
    fetchData();
    
    // 定时器
    const timer = setInterval(fetchData, 12000); // 12秒一回合
    return () => clearInterval(timer);
  }, []);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    // 整体布局：左右分栏 (Flex Row)，浅色背景
    <div className="flex h-[100dvh] w-full bg-[#f8f9fa] text-gray-800 font-sans overflow-hidden">
      
      {/* --- 左侧侧边栏：环境与状态 (占 30% - 40%) --- */}
      <aside className="w-[350px] shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 hidden md:flex">
        
        {/* 顶部：时间与天气 */}
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">
             AI_ISLAND
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
             <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>
             <span>DAY {envInfo.day} · {envInfo.time}</span>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
               <span className="text-2xl">🌤</span> 
               <span className="font-semibold text-gray-700">{envInfo.weather}</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed italic">
              “{envInfo.desc}”
            </p>
          </div>
        </div>

        {/* 中部：角色列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Survivors</h3>
           {agents.map(agent => (
             <div key={agent.id} className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-1">
                 <div>
                   <span className="font-bold text-gray-800">{agent.name}</span>
                   <span className="text-xs text-gray-400 ml-2">{agent.job}</span>
                 </div>
                 <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${agent.hp > 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                   HP {agent.hp}
                 </span>
               </div>
               
               <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                 <span>📍 {agent.locationName}</span>
                 <span className="text-gray-300">|</span>
                 <span>🥣 饱食 {100 - agent.hunger}%</span>
               </div>

               <div className="text-xs bg-gray-50 p-2 rounded text-gray-600 italic">
                 "{agent.actionLog}"
               </div>
             </div>
           ))}
        </div>

        {/* 底部：控制台/状态 */}
        <div className="p-4 border-t border-gray-100 text-xs text-center text-gray-400">
          系统自动运行中...
        </div>
      </aside>

      {/* --- 右侧主区域：小说阅读模式 --- */}
      <main className="flex-1 flex flex-col relative">
        {/* 移动端顶部栏 (仅手机显示) */}
        <div className="md:hidden p-4 bg-white border-b flex justify-between items-center shadow-sm">
           <span className="font-bold">DAY {envInfo.day} · {envInfo.time}</span>
           <span className="text-xs text-gray-500">{envInfo.weather}</span>
        </div>

        {/* 日志滚动区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth">
          {logs.length === 0 && (
             <div className="h-full flex items-center justify-center text-gray-300">
               正在生成世界...
             </div>
          )}
          
          {logs.map((log, i) => (
            <article key={i} className="max-w-3xl mx-auto">
              {/* 日期分隔符 (如果是新的一天，可以在逻辑里加标记，这里简单处理) */}
              
              <div className="prose prose-slate prose-p:leading-loose prose-p:text-gray-700">
                 {/* 我们假设 log 本身就是一段纯文本，没有奇怪的符号 */}
                 <p className="text-base md:text-lg text-justify">
                   {log}
                 </p>
              </div>
              
              {/* 装饰性分割线 */}
              <div className="w-8 h-[1px] bg-gray-200 mt-8 mb-4 mx-auto"></div>
            </article>
          ))}
          
          {/* 底部留白 */}
          <div className="h-20"></div>
        </div>

        {/* Loading 指示器 (悬浮在右下角) */}
        {loading && (
          <div className="absolute bottom-6 right-6 bg-white/80 backdrop-blur border border-gray-200 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm text-blue-600">
             <span className="animate-spin">⏳</span>
             <span>推演中...</span>
          </div>
        )}
      </main>

    </div>
  );
}