export const getLevelInfo = (xp = 0) => {
    // XP required to level up at each level L
    const getXpForNextLevel = (l) => {
        if (l < 3) return 100;
        if (l < 5) return 250;
        if (l < 10) return 500;
        if (l < 20) return 1000;
        if (l < 30) return 2000;
        return 3000;
    };

    let level = 1;
    let remainingXp = xp;
    
    while (true) {
        const required = getXpForNextLevel(level);
        if (remainingXp >= required) {
            remainingXp -= required;
            level++;
        } else {
            break;
        }
    }
    
    const nextLevelXp = getXpForNextLevel(level);
    const xpInLevel = remainingXp;
    const xpNeeded = nextLevelXp - xpInLevel;
    const xpPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / nextLevelXp) * 100)));
    
    let rank = 'Novice Pawn';
    let badgeEmoji = '♙';
    let rankColor = 'text-slate-400';
    let badgeBg = 'bg-slate-500/10 border-slate-500/20';

    if (level >= 30) {
        rank = 'Grandmaster';
        badgeEmoji = '♔';
        rankColor = 'text-red-400';
        badgeBg = 'bg-red-500/10 border-red-500/20';
    } else if (level >= 20) {
        rank = 'Outstanding Queen';
        badgeEmoji = '♕';
        rankColor = 'text-fuchsia-400';
        badgeBg = 'bg-fuchsia-500/10 border-fuchsia-500/20';
    } else if (level >= 10) {
        rank = 'Fearless Rook';
        badgeEmoji = '♖';
        rankColor = 'text-amber-400';
        badgeBg = 'bg-amber-500/10 border-amber-500/20';
    } else if (level >= 5) {
        rank = 'Tactical Bishop';
        badgeEmoji = '♗';
        rankColor = 'text-emerald-400';
        badgeBg = 'bg-emerald-500/10 border-emerald-500/20';
    } else if (level >= 3) {
        rank = 'Skilled Knight';
        badgeEmoji = '♘';
        rankColor = 'text-cyan-400';
        badgeBg = 'bg-cyan-500/10 border-cyan-500/20';
    }
    
    return { level, xpInLevel, nextLevelXp, xpNeeded, xpPercent, rank, badgeEmoji, rankColor, badgeBg };
};
