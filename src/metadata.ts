import { CharacterBuilderCache as Cache } from 'src/cache.ts';

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
	dexterity: "Agilité",
	constitution: "Constitution",
	intelligence: "Intelligence",
	perception: "Perception",
	charisma: "Charisme",
	will: "Volonté",
} as const;
export interface Level {
	level: number;
	talents: Talent[];
	buffedStat: string;
	buffedSubstats: Substats;
	hp: number;
	focus: number;
	flavoring: string;
}

export interface Metadata {
	type: string;
	freeMode: boolean;

	setting: string;
	name: string

	armor: number;
	luck: number;

	race: Race;

	statBlock: StatBlock;
	substats: Substats;

	levels: Level[];

	flavoring: string;
}
interface TalentStat
{
	stat: string;
	value: number;
}

export class TalentMetadata
{
	valid: boolean;
	talent: Talent;
	file: TFile;

	choices: number;
	options: Talent[] | string[]; //Dans le futur, il y aura une distinction entre sous talent et option de talent (diférence entre Style de combat ou Faveur de pacte et Metamagie par exemple)
	
	dependencies: Talent[];
	stats: TalentStat[]
	blocking: Talent[]; // TODO
	level: number;
	stackable: boolean;

	metadata: any;
	content: string;

	heading: string;

	constructor(file: TFile, content: string, app: App)
	{
		const metadata = app.metadataCache.getFileCache(file);
		if(!metadata.hasOwnProperty("headings") || !metadata.hasOwnProperty("sections"))
			return;

		const hierarchy = headingHierarchy(metadata.headings);

		this.valid = true;
		this.talent = { name: file.basename, subname: undefined };
		this.file = file;
		this.stats = [];
		this.metadata = metadata;
		this.content = content;
		this.dependencies = /[Pp]r[eé]requis ?:? ? ?:? ?(.+)[\n\,]/g.test(this.content) ? this.metadata?.links?.filter(e => !this.metadata.headings[1] || e.position.start.offset < this.metadata.headings[1].position.start.offset).map(e => TalentMetadata.fromLink(e.link)) : undefined;

		for(const stat of Object.keys(StatBlockNames))
		{
			const match = new RegExp(`${StatBlockNames[stat]}.*> ?(\\\d{1,3})`, "gi").exec(this.content)
			if(match !== null)
				this.stats.push({stat: stat, value: match[1]});
		}

		this.heading = this.metadata.headings[0].heading;
		this.stackable = /(?<!non )[Cc]umulable/.test(this.content);
		this.level = Infinity;

		const levelRegex = /[Nn]iveau (\d+)/g;
		let match;
		while((match = levelRegex.exec(this.content)) !== null) this.level = Math.min(this.level, match[1]);

		if(this.level === Infinity || this.file.parent.name.includes("Talent de base")) this.level = 1;

		this.options = hierarchy && hierarchy[0] && hierarchy[0]?.hierarchy?.filter(e => e.level === 2)?.map(e => { return { name: file.basename, subname: e.heading.replace(/[\(\)\*]/g, "")}; } ) || undefined;
		if(this.options && this.options.length === 0)
			this.options = undefined;
	}
	static fromLink(link: string): Talent
	{
		return { name: link.substring(0, link.indexOf("#") === -1 ? link.length : link.indexOf("#")), subname: link.indexOf("#") !== -1 ? link.substring(link.indexOf("#") + 1) : undefined };
	}
	static compare(src: Talent, target: Talent, nameOnly: boolean = false): boolean
	{
		if(target.subname === undefined && nameOnly)
		{
			return src.name === target.name;
		}
		else
		{
			return src.name === target.name && src.subname === target.subname;
		}
	}
	static embed(talent: Talent): string
	{
		if(talent.subname)
		{
			return `![[${talent.name}#${talent.subname}]]`;
		}
		else
		{
			return `![[${talent.name}#${Cache.cache(`talents/registry/${talent.name}/heading`)}]]`;
		}
	}
	static text(talent: Talent): string
	{
		if(talent.subname)
		{
			return `${talent.name}#${talent.subname}`;
		}
		else
		{
			return `${talent.name}`;
		}
	}
	static includes(talents: Talent[], talent: Talent, nameOnly: boolean = false): boolean
	{
		for(let i = 0; i < talents.length; i++)
		{
			if(TalentMetadata.compare(talents[i], talent, nameOnly))
				return true;
		}
		return false;
	}
	static every(src: Talent[], target: Talent[], nameOnly: boolean = false): boolean
	{
		for(let i = 0; i < src.length; i++)
		{
			if(!TalentMetadata.includes(target, src[i], nameOnly))
				return false;
		}
		return true;
	}
	static some(src: Talent[], target: Talent[], nameOnly: boolean = false): boolean
	{
		for(let i = 0; i < src.length; i++)
		{
			if(TalentMetadata.includes(target, src[i], nameOnly))
				return true;
		}
		return false;
	}
}
export interface Talent
{
	name: string;
	subname: string //Pour les talents comme Sorts#Instinct
}
export interface Collection
{
	[name: string]: string;
}
export class RaceMetadata
{
	valid: boolean;
	race: Race;
	file: TFile;

	health: number;

	subraces: Collection;
	features: Collection;

	metadata: any;
	content: string;

	constructor(file: TFile, content: string, app: App)
	{
		const metadata = app.metadataCache.getFileCache(file);

		if(!metadata.hasOwnProperty("headings") || !metadata.hasOwnProperty("sections"))
			return;

		this.valid = true;
		this.file = file;
		this.metadata = metadata;
		const globalBonusIdx = metadata.headings.findIndex(e => e.heading.toUpperCase() === "BONUS GLOBAUX");
		this.content = content.substring(metadata.headings[0].position.start.offset, metadata.headings[globalBonusIdx + 1].position.start.offset - 1);
		this.subraces = metadata.headings.slice(0, metadata.headings.findIndex(e => e.heading.replaceAll("*", "").toUpperCase().startsWith("BONUS RACIA") || e.heading.replaceAll("*", "").toUpperCase().startsWith("OPTION"))).map((e, i) => i).slice(globalBonusIdx + 2).map(e => metadata.headings[e].heading).reduce((p, v) => {
			p[v] = contentOfHeading(metadata, content, v, true); return p;
		}, {});
		const idx = metadata.headings.findIndex(e => e.heading.replaceAll("*", "").toUpperCase().startsWith("BONUS RACIA") || e.heading.replaceAll("*", "").toUpperCase().startsWith("OPTION"));

		if(idx === -1)
		{
			this.valid = false;
			return;
		}

		const start = metadata.headings[idx].position.end.offset, end = idx === metadata.headings.length - 1 ? content.length : metadata.headings[idx + 1].position.start.offset;
		this.features = metadata.sections.reduce((p, v) => { 
			if(v.position.start.offset >= start && v.position.end.offset <= end) 
			{
				const paragraph = content.substring(v.position.start.offset, v.position.end.offset);
				const match = /\*\*(.+)\*\*/g.exec(paragraph);

				if(match)
					p[match[1].replace(/\*/g, "").replace(".", "")] = paragraph;
			}
			return p;
		}, {});

		this.race = { name: file.basename };

		const hpMatch = /.+?points de vie.+?niveau 1.+?(\d+)\.?\n?/i.exec(this.content);
		this.health = hpMatch ? parseInt(hpMatch[1]) : 0;

		let bonusesMatch = /Augmentation.+? (.+?)\n/i.exec(this.content);

		if(!bonusesMatch)
		{
			this.valid = false;
			return;
		}
		bonusesMatch = bonusesMatch[1].trim().replace(/\*\,\./g, "").toLowerCase();
		const stats = Object.values(StatBlockNames);
		this.race.bonus1 = this.race.bonus2 = this.race.bonus3 = "";
		for(let i = 0; i < stats.length; i++)
		{
			if(bonusesMatch.includes(stats[i].toLowerCase()))
			{
				const followingBonus = /\d/.exec(bonusesMatch.substring(bonusesMatch.indexOf(stats[i].toLowerCase())));
				if(followingBonus && followingBonus[0] === '6')
				{
					this.race.malus1 = getStatFromLocale(stats[i]);
				}
				else if(this.race.bonus1 === "")
				{
					this.race.bonus1 = getStatFromLocale(stats[i]);
				}
				else if(this.race.bonus2 === "")
				{
					this.race.bonus2 = getStatFromLocale(stats[i]);
				}
				else if(this.race.bonus3 === "")
				{
					this.race.bonus3 = getStatFromLocale(stats[i]);
				}
				bonusesMatch = bonusesMatch.replaceAll(stats[i].toLowerCase(), "");
			}
		}
	}
}
export interface Race
{
	name: string;
	subname: string;
	feature: string;

	bonus1: string;
	bonus2: string;
	bonus3: string;
	bonus4?: string;
	malus1?: string;
}

function headingHierarchy(headings)
{
    const hierarchy = [], minLevel = headings.reduce((p, v) => Math.min(p, v.level), 10);
    for(let i = 0; i < headings.length; i++)
    {
        if(headings[i].level === minLevel)
            hierarchy.push(headingChild(headings.slice(i)));
    }
    return hierarchy;
}
function headingChild(headings)
{
    const level = headings[0].level, nextLevel = headings[1]?.level || 0;
    let lastIndex = headings.slice(1).findIndex(e => e.level === level);
    if(lastIndex === -1)
        lastIndex = headings.length;

    const child = headings.slice(1).reduce((p, v, i, a) => { if(i < lastIndex && v.level === nextLevel) p.push(headingChild(a.slice(i))); return p; }, []);
    if(child.length !== 0)
        headings[0].hierarchy = child;
    return headings[0];
}
function contentOfHeading(metadata: any, content: string, heading: string, includeHeading: boolean = false)
{
	const head = metadata.headings.find(e => e.heading === heading);
	const start = includeHeading ? head.position.start.offset : head.position.end.offset;
	let end;
	
	for(let i = 0; i < metadata.sections.length; i++)
	{
		const sec = metadata.sections[i];
		if(start < sec.position.start.offset && sec.type === "heading")
			break;

		if(start < sec.position.start.offset)
			end = sec.position.end.offset;
	}
	return content.substring(start, end);
}
function getStatFromLocale(text: string): string
{
	return Object.keys(StatBlockNames)[Object.values(StatBlockNames).findIndex(e => e.toLowerCase() === text.toLowerCase())];
}