export interface Substats {
	[name: string]: number;
}
export const Stat = {
	initial: 0,
	bonus: 0,
} as const;
export const StatBlock = {
	strength: {...Stat},
	dexterity: {...Stat},
	constitution: {...Stat},
	intelligence: {...Stat},
	perception: {...Stat},
	charisma: {...Stat},
	will: {...Stat},
} as const;
export const StatBlockNames = {
	strength: "Force",
	dexterity: "Dextérité",
	constitution: "Constitution",
	intelligence: "Intelligence",
	perception: "Perception",
	charisma: "Charisme",
	will: "Volonté",
} as const;
export interface Level {
	level: number;
	talents: string[];
	buffedStat: string;
	buffedSubstats: Substats;
	hp: number;
	focus: number;
	flavoring: string;
}

export interface Metadata {
	type: string;

	setting: string;
	name: string

	armor: number;
	luck: number;

	race: string;
	subrace: string;
	feature: string;

	statBlock: StatBlock;
	substats: Substats;

	levels: Level[];

	flavoring: string;
}