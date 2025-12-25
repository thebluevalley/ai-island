/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true, // 允许 DiceBear 的 SVG 格式
  },
  // 删除之前的 contentSecurityPolicy，因为它拦截了图片请求
};

export default nextConfig;