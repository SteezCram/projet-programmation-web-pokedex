const fs = require('fs');
const path = require('path');

const Pokemon = require('./pokemon');




/**
 * Verify if a file exists in the file system. This function is used to avoid the use of the synchronous method fs.existsSync().
 * @param {string} itemPath - Path of the item to check
 * @returns {Promise<boolean>} True if the item exists, false otherwise
 */
function fileExists(itemPath)
{
    return new Promise((resolve, reject) =>
    {
        fs.access(itemPath, (err) => {
            if (err) {
                resolve(false)
                return;
            }

            resolve(true);
        });
    });
}

module.exports = class PokemonDatabase
{
    /**
     * Create a new pokemon in the database.
     * @param {Pokemon} pokemon - The pokemon to be saved to the database
     * @returns {boolean} - True if the pokemon was saved successfully, false otherwise
     */
    static async create(pokemon)
    {
        if (pokemon == null)
            return false;

        pokemon.id = pokemon.id.padStart(4, '0');

        if (await fileExists(path.join('data', `${pokemon.id}.json`)))
            return false;

        try
        {
            if (pokemon.image != null)
            {
                pokemon.image.name = `${pokemon.id}${pokemon.image.name}`;
                await PokemonDatabase.setImage(pokemon.image.name, pokemon.image.data);
            }

            delete pokemon.image;
            
            await fs.promises.writeFile(path.join('data', `${pokemon.id}.json`), JSON.stringify(pokemon));

            return true;
        }
        catch (error) {
            console.error(error);
            return false;
        }
    }

    /**
     * Delete a pokemon from the database.
     * @param {string} id - The id of the pokemon to be deleted
     * @returns {Promise<boolean>} True if the pokemon was deleted successfully, false otherwise
     */
    static async delete(id)
    {
        if (id == null)
            return false;

        try
        {
            const imagePath = await PokemonDatabase.getImage(id);

            if (imagePath === '')
                return false;

            await fs.promises.unlink(path.join('data', `${id}.json`));
            await fs.promises.unlink(path.join('static', imagePath));
            
            return true;
        }
        catch (error) {
            console.error(error);
            return false;
        }
    }

    /**
     * Verify if a pokemon exists in the database.
     * @param {string} id - The id of the pokemon to verify
     * @returns {Promise<boolean>} - True if the pokemon exists, false otherwise
     */
    static async exists(id)
    {
        if (id == null)
            return false;

        if (!await fileExists(path.join('data', `${id}.json`)))
            return false;

        return true;
    }


    /**
     * Get a pokemon from the database.
     * @param {string} id - The id of the pokemon to be retrieved
     * @returns {Pokemon} - The pokemon with the given id, or null if the pokemon does not exist
     */
    static async get(id)
    {
        if (id == null)
            return null;

        if (!await fileExists(path.join('data', `${id}.json`)))
            return null;

        try
        {
            let pokemonData = JSON.parse(await fs.promises.readFile(path.join('data', `${id}.json`)));
            
            const pokemon = new Pokemon(pokemonData.id, pokemonData.name, pokemonData.size, pokemonData.weight, pokemonData.types, pokemonData.ability, pokemonData.description);
            pokemon.ability.description = await PokemonDatabase.getAbilityDescription(pokemon.ability.name);
            pokemon.image = await PokemonDatabase.getImage(pokemon.id);
            // Remove duplicates using the Set object
            pokemon.strengths = [...new Set((await PokemonDatabase.getStrengths(pokemon.types[0])).concat(await PokemonDatabase.getStrengths(pokemon.types[1] || [])))];
            pokemon.weaknesses = [...new Set((await PokemonDatabase.getWeaknesses(pokemon.types[0])).concat(await PokemonDatabase.getWeaknesses(pokemon.types[1] || [])))]
                .filter(x => x !== pokemon.types[0] && x !== pokemon.types[1]);

            // Remove the strengths that are also weaknesses
            for (let i = 0; i < pokemon.strengths.length; i++)
            {
                let index = pokemon.weaknesses.indexOf(pokemon.strengths[i]);

                if (index !== -1)
                {
                    pokemon.strengths.splice(i, 1);
                    pokemon.weaknesses.splice(index, 1);
                }
            }
            
            return pokemon;
        }
        catch (error) {
            console.error(error);
            return null;
        }
    }

    /**
     * Get all the pokemons in the database.
     * @returns {Promise<Pokemon[]>} - An array of all the pokemons in the database
     */
    static async getAll()
    {
        const files = await fs.promises.readdir('data');
        const pokemons = [];

        for (let i = 0; i < files.length; i++)
        {
            const pokemon = await PokemonDatabase.get(files[i].split('.')[0]);
            if (pokemon == null) continue;

            pokemons.push(pokemon);
        }

        return pokemons;
    }


    /**
     * Get the description of the ability of the pokemon.
     * @param {string} ability - The ability of the pokemon
     * @returns {Promise<string>} A promise that resolves when the description is set and return the description
     */
    static async getAbilityDescription(ability)
    {
        const abilities = JSON.parse(await fs.promises.readFile(path.join('static', 'abilities.json'), 'utf8'));

        return abilities.find(x => x.name === ability).description || 'No description available';
    }

    /**
     * Get the strengths for a pokemon type.
     * @param {string} type - The type of the pokemon
     * @returns {Promise<Array<string>>} A promise that resolves when the strengths are set and return the strengths
     */
    static async getStrengths(type)
    {
        const types = JSON.parse(await fs.promises.readFile(path.join('static', 'types.json'), 'utf8'))
            .map(x => ({
                name: x.name,
                atk_effectives: x.atk_effectives.filter(y => y[0] === type && y[1] < 1)
            }))
            .filter(x => x.atk_effectives.length > 0 && x.name !== type)
            .map(x => x.name);

        // Return a unique array of types, use Set object to remove duplicates in the array
        return types || [];
    }

    /**
     * Get the weaknesses for a pokemon type.
     * @param {string} type - The type of the pokemon
     * @returns {Promise<Array<string>>} A promise that resolves when the weaknesses are set and return the weaknesses
     */
    static async getWeaknesses(type)
    {
        const types = JSON.parse(await fs.promises.readFile(path.join('static', 'types.json'), 'utf8'))
            .map(x => ({
                name: x.name,
                atk_effectives: x.atk_effectives.filter(y => y[0] === type && y[1] > 1)
            }))
            .filter(x => x.atk_effectives.length > 0 && x.name !== type)
            .map(x => x.name);

        // Return a unique array of types, use Set object to remove duplicates in the array
        return types || [];
    }


    /**
     * Get the image of the pokemon.
     * @param {string} id - The id of the pokemon to be updated
     * @returns {Promise<string>} - The path to the image of the pokemon
     */
    static async getImage(id)
    {
        if (id == null)
            return '';

        const files = await fs.promises.readdir(path.join('static', 'img', 'pokemons'));
        const fileName = files.find(file => file.startsWith(id));

        if (!fileName)
            return '';

        return `/img/pokemons/${fileName}`;
    }

    /**
     * Set the image of the pokemon.
     * @param {string} id - The id of the pokemon to be updated 
     * @param {string} imageName - The image name of the pokemon
     * @param {string} imageDataBase64 - The image of the pokemon in base64 format
     * @returns {Promise<void>} A promise that resolves when the image is set
     */
    static async setImage(imageName, imageDataBase64)
    {
        if (imageName === null || imageDataBase64 === null)
            return;

        if (!await fileExists(path.join('static', 'img', 'pokemons')))
            await fs.promises.mkdir(path.join('static', 'img', 'pokemons'), { recursive: true });

        try {
            const buffer = Buffer.from(imageDataBase64.split(',')[1], 'base64'); 
            await fs.promises.writeFile(path.join('static', 'img', 'pokemons', imageName), buffer);
        }
        catch (error) {
            console.error(error);
        }
    }


    /**
     * Search for a pokemon in the database by its name in the database.
     * @param {string} name - Name of the pokemon to be searched
     * @returns {Promise<Pokemon[]>} - An array of all the pokemons that match the search criteria
     */
    static async search(query)
    {
        // Trim query to avoid empty spaces
        query = query.toLowerCase().trim();

        let queryLength = query.length;
        let pokemons = await PokemonDatabase.getAll();

        let results = pokemons.map(pokemon =>
        {
            let searchItem = pokemon.name.toLowerCase();
            let searchItemLength = searchItem.length;

            let matrix = Array.from(Array(queryLength + 1).fill(0), () => new Array(searchItemLength + 1).fill(0));

            for (let i = 0; i <= queryLength; i++)
            {
                matrix[i][0] = i;
            }

            for (let j = 0; j <= searchItemLength; j++)
            {
                matrix[0][j] = j;
            }

            for (let i = 1; i <= queryLength; i++)
            {
                for (let j = 1; j <= searchItemLength; j++)
                {
                    let cost = (searchItem[j - 1] == query[i - 1]) ? 0 : 1;
                    
                    matrix[i][j] = Math.min(Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1), matrix[i - 1][j - 1] + cost);
                }
            }

            return {
                id: pokemon.id,
                image: pokemon.image,
                name: pokemon.name,
                score: 1.0 - (matrix[queryLength][searchItemLength] / Math.max(queryLength, searchItemLength))
            };
        })
        .filter(x => x.score > 0.35)
        .slice(0, 3);
        
        return results;
    }


    /**
     * Update the pokemon in the database.
     * @param {string} id - The id of the pokemon to be updated
     * @param {object} data - The data to be updated
     * @returns {Promise<boolean>} True if the pokemon was deleted successfully, false otherwise
     */
    static async update(id, data)
    {
        if (!await fileExists(path.join('data', `${id}.json`)))
            return false;

        try 
        {
            const pokemon = JSON.parse(await fs.promises.readFile(path.join('data', `${id}.json`), 'utf8'));

            // Only update the properties that are not null
            for (let key in data)
            {
                if (key === 'image')
                    continue;

                pokemon[key] = data[key];
            }
            
            // Update the image if it was changed
            if (data.image)
                await PokemonDatabase.setImage(data.image.name, data.image.data);

            await fs.promises.writeFile(path.join('data', `${id}.json`), JSON.stringify(pokemon));

            return true;
        }
        catch (error) {
            console.error(error);
            return false;
        }
    }
}