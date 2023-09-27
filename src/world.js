// Copyright (C) 2022 Radioactive64

import APIConnection from "./connection.js";

/**
 * `MapManager` class represents all maps within a world
 */
export class MapManager {
    #apiConnection;
    #maps = new Map();

    /**
     * Create new `MapManager`
     * @param {APIConnection} apiConnection `APIConnection` to host 
     */
    constructor(apiConnection) {
        if (!(apiConnection instanceof APIConnection)) throw new TypeError('"apiConnection" must be an instance of APIConnection');
        this.#apiConnection = apiConnection;
    }

    /**
     * Load list of maps to `World`
     * @param {Array.<string>} maps List of map names 
     */
    async loadMaps(maps) {
        for (let i in maps) {
            let manager = new World(maps[i], this.#apiConnection);
            await manager.load();
            this.#maps.set(i, manager);
        }
    }
}

/**
 * `World` class represents and controls a single map
 */
class World {
    #apiConnection;
    #layers;
    #name = 'World';

    /**
     * Create new `MapManager`
     * @param {string} name Name of map
     * @param {APIConnection} apiConnection `APIConnection` to host 
     */
    constructor(name, apiConnection) {
        if (!(apiConnection instanceof APIConnection)) throw new TypeError('"apiConnection" must be an instance of APIConnection');
        this.#apiConnection = apiConnection;
        this.#layers = [];
        this.#name = name;
    }

    /**
     * Loads map from server
     */
    async load() {
        const raw = await this.#apiConnection.requestJSONFile('/maps/' + this.#name + '.json');
        for (let rawlayer of raw.layers) {
            if (rawlayer.name.includes('Collision:')) {
                // ensure layer exists
                let layer = parseInt(rawlayer.name.replace('Collision:', ''));
                if (this.#layers[layer] === undefined) {
                    this.#layers[layer] = new Layer(layer);
                }
                // load collisions and set to layer
                let collisions = CollisionGrid.fromArray(rawlayer.chunks ?? rawlayer.data, rawlayer.startx ?? 0, rawlayer.starty ?? 0, rawlayer.width, rawlayer.height);
                this.#layers[layer].setCollisions(collisions);
            }
        }
    }
}

class Layer {
    #collisions;
    #layer;

    constructor(layer) {
        if (!Number.isInteger(layer)) throw new TypeError('"layer" must be an integer');
        this.#layer = layer;
        this.#collisions = new CollisionGrid();
    }

    /**
     * @returns {number} Layer of Layer
     */
    get layer() {
        return this.#layer;
    }
    /**
     * Replaces the collisions of the `Layer`
     * @param {CollisionGrid} c `CollisionGrid` object to set
     */
    setCollisions(c) {
        if (c instanceof CollisionGrid) this.#collisions = c;
        else throw new TypeError('"c" must be an instance of CollisionGrid');
    }
    /**
     * Gets `CollisionGrid` stored within the `Layer`
     * @returns {CollisionGrid} `CollisionGrid` of layer
     */
    collisions() {
        return this.#collisions;
    }
}

/**
 * Grid interface representing a 2D grid of numbers of fixed width and height. Has a minimum and maximum value for both x and y.
 */
class Grid {
    #grid;
    #width = 0;
    #height = 0;
    #xmin = Number.MAX_SAFE_INTEGER;
    #ymin = Number.MAX_SAFE_INTEGER;

    /**
     * Create new `Grid` of set width and height and origin of (x, y)
     * @param {number} x Origin x of grid
     * @param {number} y Origin y of grid
     * @param {number} w Width of grid
     * @param {number} h Height of grid
     */
    constructor(x, y, w, h) {
        this.#xmin = x;
        this.#ymin = y;
        this.#width = w;
        this.#height = h;
        this.#grid = [];
        for (let y = 0; y <= h; y++) {
            this.#grid[y] = [];
            for (let x = 0; x <= w; x++) {
                this.#grid[y][x] = 0;
            }
        }
    }

    /**
     * @returns {number} Width of `Grid`
     */
    get width() {
        return this.#width;
    }
    /**
     * @returns {number} Height of `Grid`
     */
    get height() {
        return this.#height;
    }
    /**
     * Gets a value within the `Grid`
     * @param {number} x X position
     * @param {number} y Y position
     * @returns {number} Value of position
     */
    get(x, y) {
        if (!Number.isInteger(x) || !Number.isInteger(y)) throw new TypeError('"x" and "y" must be integers');
        if (x < this.#xmin || x > this.#width+this.#xmin || y < this.#ymin || y > this.#height+this.#ymin) throw new RangeError(`Position (${x}, ${y}) - internally (${x-this.#xmin}, ${y-this.#ymin}) - out of bounds for Grid of size <${this.#width}, ${this.#height}>`);
        return this.#grid[y-this.#ymin][x-this.#xmin];
    }
    /**
     * Sets a value within the `Grid`
     * @param {number} x X position
     * @param {number} y Y position
     * @param {number} val Value of position
     */
    set(x, y, val) {
        if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(val)) throw new TypeError('"x", "y", and "val" must be integers');
        if (x < this.#xmin || x > this.#width+this.#xmin || y < this.#ymin || y > this.#height+this.#ymin) throw new RangeError(`Position (${x}, ${y}) - internally (${x-this.#xmin}, ${y-this.#ymin}) - out of bounds for Grid of size <${this.#width}, ${this.#height}>`);
        this.#grid[y-this.#ymin][x-this.#xmin] = val;
    }

    /**
     * Creates a clone of a `Grid`
     * @param {Grid} grid `Grid` object to clone
     * @returns {Grid} Copy of `Grid` object
     */
    static clone(grid) {
        if (!grid instanceof Grid) throw new TypeError('"grid must be a Grid');
        const copy = new Grid(grid.#xmin, grid.#ymin, grid.#width, grid.#height);
        copy.#grid = grid.#grid;
        return copy;
    }
    /** 
     * Converts a 1-dimensional array to a 2-dimensional grid of `width` and `height`, returning the resulting `CollisionGrid` object
     * @param {Array.<number>} data Array of integers to convert to a `Grid`
     * @param {number} x Origin x of output `Grid`
     * @param {number} y Origin y of output `Grid`
     * @param {number} w Width of output `Grid`
     * @param {number} h Height of output `Grid`
     * @returns {CollisionGrid} Resulting `Grid` object
    */
    static fromArray(data, x, y, w, h) {
        if (!Array.isArray(data)) throw new TypeError('"data" must be an Array');
        // create new `Grid`
        const resGrid = new CollisionGrid(x, y, w, h);
        // check if chunks or just array, then populate grid
        if (typeof data[0] === 'object') {
            for (let rawchunk of data) {
                for (let i in rawchunk.data) {
                    let x = (i % rawchunk.width) + rawchunk.x;
                    let y = ~~(i / rawchunk.width) + rawchunk.y;
                    resGrid.set(x, y, rawchunk.data[i]);
                }
            }
        } else {
            for (let i in data) {
                let x = (i % w);
                let y = ~~(i / w);
                resGrid.set(x, y, data[i]);
            }
        }
        return resGrid;
    }
}

/**
 * `CollisionGrid` class is an implementation of `Grid`, representing a 2D grid of collision tiles of fixed width and height. Has minimum and maximum values for both x and y.
 */
class CollisionGrid extends Grid {
    #grid;
    #width = 0;
    #height = 0;
    #xmin = Number.MAX_SAFE_INTEGER;
    #ymin = Number.MAX_SAFE_INTEGER;

    /**
     * Create new `CollisionGrid`
     * @param {number} x Origin x of grid
     * @param {number} y Origin y of grid
     * @param {number} w Width of grid
     * @param {number} h Height of grid
     */
    constructor(x, y, w, h) {
        super(w, h);
        this.#xmin = x;
        this.#ymin = y;
        this.#width = w;
        this.#height = h;
        this.#grid = [];
        for (let y = 0; y <= h; y++) {
            this.#grid[y] = [];
            for (let x = 0; x <= w; x++) {
                this.#grid[y][x] = 0;
            }
        }
    }

    /**
     * Gets a value within the `CollisionGrid`
     * @param {number} x X position
     * @param {number} y Y position
     * @returns {number} Value of position
     */
    get(x, y) {
        if (!Number.isInteger(x) || !Number.isInteger(y)) throw new TypeError('"x" and "y" must be integers');
        if (x < this.#xmin || x > this.#width+this.#xmin || y < this.#ymin || y > this.#height+this.#ymin) throw new RangeError(`Position (${x}, ${y}) - internally (${x-this.#xmin}, ${y-this.#ymin}) - out of bounds for CollisionGrid of size <${this.#width}, ${this.#height}>`);
        return this.#grid[y-this.#ymin][x-this.#xmin];
    }
    /**
     * Sets a value within the `CollisionGrid`
     * @param {number} x X position
     * @param {number} y Y position
     * @param {number} val New collision identifier of position
     */
    set(x, y, val) {
        if (!Number.isInteger(x) || !Number.isInteger(y)) throw new TypeError('"x" and "y" must be integers');
        if (x < this.#xmin || x > this.#width+this.#xmin || y < this.#ymin || y > this.#height+this.#ymin) throw new RangeError(`Position (${x}, ${y}) - internally (${x-this.#xmin}, ${y-this.#ymin}) - out of bounds for CollisionGrid of size <${this.#width}, ${this.#height}>`);
        this.#grid[y-this.#ymin][x-this.#xmin] = CollisionGrid.mapToCollision(val);
    }

    /**
     * Creates a clone of a `CollisionGrid`
     * @param {CollisionGrid} grid `CollisionGrid` object to clone
     * @returns {CollisionGrid} Copy of `CollisionGrid` object
     */
    static clone(grid) {
        if (!grid instanceof CollisionGrid) throw new TypeError('"grid must be a CollisionGrid');
        const copy = new CollisionGrid(grid.#xmin, grid.#ymin, grid.#width, grid.#height);
        copy.#grid = grid.#grid;
        return copy;
    }
    /** 
     * Converts a 1-dimensional array to a 2-dimensional grid of `width` and `height`, returning the resulting `CollisionGrid` object
     * @param {Array.<number>} data Array of integers to convert to a `Grid`
     * @param {number} x Origin x of output `Grid`
     * @param {number} y Origin y of output `Grid`
     * @param {number} w Width of output `Grid`
     * @param {number} h Height of output `Grid`
     * @returns {CollisionGrid} Resulting `Grid` object
    */
    static fromArray(data, x, y, w, h) {
        if (!Array.isArray(data)) throw new TypeError('"data" must be an Array');
        // create new `Grid`
        const resGrid = new CollisionGrid(x, y, w, h);
        // check if chunks or just array, then populate grid
        if (typeof data[0] === 'object') {
            for (let rawchunk of data) {
                for (let i in rawchunk.data) {
                    let x = (i % rawchunk.width) + rawchunk.x;
                    let y = ~~(i / rawchunk.width) + rawchunk.y;
                    resGrid.set(x, y, rawchunk.data[i]);
                }
            }
        } else {
            for (let i in data) {
                let x = (i % w);
                let y = ~~(i / w);
                resGrid.set(x, y, data[i]);
            }
        }
        return resGrid;
    }
    /**
     * Maps a tile ID to a collision ID
     * @param {number} id Tile ID
     * @returns {number} Correspinding collision ID
     */
    static mapToCollision(id) {
        return id;
    }
}