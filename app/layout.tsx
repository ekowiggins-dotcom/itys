import './globals.css';
import './calld.css';
export const metadata={title:'Who’ll · Know your friends? Prove it.',description:'A free game for friend groups. Ask about each other, pick an answer, see who called it.',
 icons:{icon:[{url:'/brand/favicon.svg',type:'image/svg+xml'},{url:'/favicon-32.png',sizes:'32x32'}],apple:'/brand/apple-touch-icon.png'},
 openGraph:{title:'Who’ll · Know your friends? Prove it.',description:'A free game for friend groups. Ask about each other, pick an answer, see who called it.',images:[{url:'/brand/og.png',width:1200,height:630}],siteName:'Who’ll'},
 twitter:{card:'summary_large_image',images:['/brand/og.png']}};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#17201B'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
