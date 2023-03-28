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
	dexterity: "Dextérité",
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

export class TalentMetadata
{
	valid: boolean;
	talent: Talent;
	file: TFile;
	options: Talent[] | string[]; //Dans le futur, il y aura une distinction entre sous talent et option de talent (diférence entre Style de combat ou Faveur de pacte et Metamagie par exemple)
	dependencies: Talent[];
	blocking: Talent[]; // TODO
	level: number;
	stackable: boolean;

	metadata: any;
	content: string;

	heading: string;

	type: string = "test";

	constructor(file: TFile, content: string, app: App)
	{
		const metadata = app.metadataCache.getFileCache(file);
		if(!metadata.hasOwnProperty("headings") || !metadata.hasOwnProperty("sections"))
			return;

		const hierarchy = headingHierarchy(metadata.headings);

		this.valid = true;
		this.talent = { name: file.basename, subname: undefined };
		this.file = file;
		this.metadata = metadata;
		this.content = content;
		this.dependencies = /[Pp]r[eé]requis ?:? ? ?:? ?(.+)[\n\,]/g.test(this.content) ? this.metadata?.links?.map(e => TalentMetadata.fromLink(e.link)) : undefined;
		this.options = hierarchy && hierarchy[0] && hierarchy[0].hierarchy && hierarchy[0].hierarchy.map(e => { return {name: this.talent.name, subname: e.heading.replaceAll("(", "").replaceAll(")", "") }; });
		this.heading = this.metadata.headings[0].heading;
		this.stackable = /(?<!non )[Cc]umulable/.test(this.content);
		this.level = Infinity;

		const levelRegex = /[Nn]iveau (\d+)/g;
		let match;
		while((match = levelRegex.exec(this.content)) !== null) this.level = Math.min(this.level, match[1]);

		if(this.level === Infinity || this.file.parent.name.includes("Talent de base")) this.level = 1;

		if(metadata.frontmatter)
		{
			if(metadata.frontmatter.hasOptions)
				this.options = metadata.frontmatter.options || this.options;
		}
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
			return `![[${talent.name}#${Cache.cache(`talents/${talent.name}`).heading}]]`;
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
