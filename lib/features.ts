// Calld is a social game: calls about your group's life. Football is switched off; the code stays for later, behind FOOTBALL=on.
export const footballEnabled=(env:Record<string,string|undefined>=process.env)=>env.FOOTBALL==='on';
