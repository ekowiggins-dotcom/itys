import './globals.css';
import './calld.css';
export const metadata={title:'Calld — Your friends. Your calls.',description:'A free prediction game for friends. Make calls, see who said what, get bragging rights.'};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#17201B'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
