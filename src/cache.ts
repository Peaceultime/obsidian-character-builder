import { TalentMetadata } from 'src/metadata.ts';

export class CharacterBuilderCache {
	static _cache = {};
	static cache(path: string, value: any): any
	{
		if(!!value)
			return CharacterBuilderCache.write_cache(path, value);
		else
			return CharacterBuilderCache.read_cache(path);
	}
	private static read_cache(path: string): any
	{
		const keys = path.split("/");
		let value = CharacterBuilderCache._cache;
		for(let i = 0; i < keys.length; i++)
		{
			if(value.hasOwnProperty(keys[i]))
				value = value[keys[i]];
			else
				return undefined;
		}
		return value;
	}
	private static write_cache(path: string, value: string|number): any
	{
		const keys = path.split("/");
		let val = CharacterBuilderCache._cache;
		for(let i = 0; i < keys.length - 1; i++)
		{
			if(val.hasOwnProperty(keys[i]))
				val = val[keys[i]];
			else
				val = val[keys[i]] = {};
		}
		val[keys[keys.length - 1]] = value;

		return value;
	}
}

export async function initCache(app: App): void {
	const settings = CharacterBuilderCache.cache("settings");
	const files = app.vault.getMarkdownFiles().reverse();

	const races = (await Promise.all(files.filter(e => e.path.startsWith(settings.racesFolder + "/")).map(e => getRaceContent(e, app)))).filter(e => !!e && !!e.content);

	const groups = races.reduce((p, v) => { if(!p.includes(v.parent)) p.push(v.parent); return p; }, []);

	for(let i = 0; i < groups.length; i++)
		CharacterBuilderCache.cache(`races/${groups[i]}/content`, races.filter(e => e.parent === groups[i]).reduce((p, v) => { p[v.name] = v; return p; }, {}));

	const talents = await Promise.all(files.filter(e => e.path.startsWith(settings.talentsFolder + "/") && !/\d\. /.test(e.basename)).map(async e => new TalentMetadata(e, await app.vault.read(e), app)));
	CharacterBuilderCache.cache("talents", talents.filter(e => e.valid).reduce((p, v) => { p[v.talent.name] = v; return p; }, {}));
}

async function getRaceContent(file: TFile, app: App): any {
	const metadata = app.metadataCache.getFileCache(file);

    if(!metadata.hasOwnProperty("headings") || !metadata.hasOwnProperty("sections"))
        return;

    const content = await app.vault.read(app.vault.getAbstractFileByPath(file.path));
    const desc = content.substring(metadata.headings[0].position.start.offset, metadata.headings[2].position.start.offset - 1);
    const subraces = metadata.headings.slice(0, metadata.headings.findIndex(e => e.heading.startsWith("BONUS RACIA"))).map((e, i) => i).slice(3).map(e => metadata.headings[e].heading).reduce((p, v) => {
    	p[v] = contentOfHeading(metadata, content, v, true); return p;
    }, {});
    const idx = metadata.headings.findIndex(e => e.heading.startsWith("BONUS RACIA"));
    const start = metadata.headings[idx].position.end.offset, end = idx === metadata.headings.length - 1 ? content.length - 1 : metadata.headings[idx + 1].position.start.offset;
    const features = metadata.sections.reduce((p, v) => { 
    	if(v.position.start.offset >= start && v.position.end.offset <= end) 
    	{
    		const paragraph = content.substring(v.position.start.offset, v.position.end.offset);
    		const match = /\*\*(.+)\*\*/g.exec(paragraph);

    		if(match)
    			p[match[1].replace(/\*/g, "").replace(".", "")] = paragraph;
    	}
    	return p;
    }, {});
    
    return { frontmatter: metadata.frontmatter, features: features, subraces: subraces, content: desc, name: file.basename, parent: file.parent.name, path: file.path };
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