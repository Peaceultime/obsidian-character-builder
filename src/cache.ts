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