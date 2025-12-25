/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // 允许所有域名，彻底解决拦截问题
      },
    ],
    dangerouslyAllowSVG: true,
    unoptimized: true, // 关键：关闭服务器端优化，直接使用源图片，防止 Vercel 超时
  },
};

export default nextConfig;