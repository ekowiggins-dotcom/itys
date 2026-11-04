// Shapes of the weekly rounds the server sends. The ranking screen itself lives in RankingTab.tsx.
export type Standing={user_id:string;name:string;active:boolean;points_tenths:number;exact_correct:number;rank:number};
export type WeeklyRound={group_type?:'Friends'|'Football'|'Mixed';timezone?:string;pick_end_at?:string;content_ready?:boolean;skip_reason?:string|null;share_code?:string|null;id:string;opens_at:string;deadline_at:string;publish_at:string;state:string;pending:number;standings:Standing[];winners:Standing[]};
