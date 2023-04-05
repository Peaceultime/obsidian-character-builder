import { TalentMetadata, RaceMetadata } from 'src/metadata.ts';

export class CharacterBuilderCache {
	static _cache = {};
	static cache(path: string, value: any): any
	{
		if(!!value)
			return CharacterBuilderCache.write_cache(path, value);
		else
			return reach(CharacterBuilderCache._cache, path);
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
export function reach(obj: any, path: string): any
{
	const keys = path.split("/");
	for(let i = 0; i < keys.length; i++)
	{
		if(obj.hasOwnProperty(keys[i]))
			obj = obj[keys[i]];
		else
			return undefined;
	}
	return obj;
}

export async function initCache(app: App): void {
	const settings = CharacterBuilderCache.cache("settings");
	const files = app.vault.getMarkdownFiles().reverse();

	const races = (await Promise.all(files.filter(e => e.path.startsWith(settings.racesFolder + "/")).map(async e => new RaceMetadata(e, await e.vault.read(e), app)))).filter(e => !!e && !!e.content);

	const groups = races.reduce((p, v) => { if(!p.includes(v.file.parent.name)) p.push(v.file.parent.name); return p; }, []);

	for(let i = 0; i < groups.length; i++)
		CharacterBuilderCache.cache(`races/${groups[i]}/content`, races.filter(e => e.file.parent.name === groups[i]).reduce((p, v) => { p[v.race.name] = v; return p; }, {}));

	const talents = await handle(app.vault.getAbstractFileByPath(settings.talentsFolder));
	console.log(CharacterBuilderCache.cache("talents", talents));
}

async function handle(file)
{
	if(file.children)
	{
		const waiting = (await Promise.all(file.children.map(async e => [e.basename || e.name, await handle(e)]))).filter(e => e[1] !== undefined);
		if(waiting.length === 0)
			return undefined;

		return Object.fromEntries(waiting);
	}
	else
	{
		if(/\d\. /.test(file.basename))
			return undefined;
		
		const talent = new TalentMetadata(file, await file.vault.read(file), app);
		return talent.valid ? talent : undefined;
	}
}