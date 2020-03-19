class Level {
    constructor () {
        this.tileWidth = 101;
        this.tileHeight = 83;
        this.widthTiles = 5;
        this.heightTiles = 6;
        this.start = {x: this.tileWidth * 2, y: this.tileHeight * 5};
        this.tiles = [];
        this.generateTiles();
    }

    generateTiles() {
        for (let column = 0; column < this.widthTiles; column++) {
            this.tiles.push('images/water-block.png');
        }
        for (let row = 0; row < 3; row++) {
            for (let column = 0; column < this.widthTiles; column++) {
                this.tiles.push('images/stone-block.png');
            }
        }
        for (let row = 0; row < 2; row++) {
            for (let column = 0; column < this.widthTiles; column++) {
                this.tiles.push('images/grass-block.png');
            }
        }
    }

    getTile(row, col) {
        return this.tiles[row * this.widthTiles + col];
    }

    widthPixels() {
        return this.tileWidth * this.widthTiles;
    }

    heightPixels() {
        return this.tileHeight * this.heightTiles;
    }
}

// Base class for any object (including enemies, player(s), other interactives)
// that are drawn onto a position on the screen
class Entity {
    constructor(pos = {x: 0, y: 0}) {
        this.pos = pos;
        this.sprite = '';
    }

    // Moves an entity by a velocity given by x and y (in pixels/s)
    // multiplied by the time variable dt
    move(velocity = {x: 0, y: 0}, dt) {
        this.pos.x += velocity.x * dt;
        this.pos.y += velocity.y * dt;
    }

    // Moves an entity by the given vector
    shiftPosition(displacement = {x: 0, y: 0}) {
        this.pos.x += displacement.x;
        this.pos.y += displacement.y;
    }

    // In order for this function to work a subclass must
    // set the "sprite" property to a string containing a valid image file name
    render() {
        if (this.sprite) {
            // entity sprites are not quite aligned with level block sprites,
            // this places them "on top of" level blocks
            const EntityYAdjust = 15;
            ctx.drawImage(Resources.get(this.sprite), this.pos.x, this.pos.y - EntityYAdjust);
        }
    }

    update(dt) {};
}

class Enemy extends Entity {
    constructor(position = {x: 0, y: 0}, movement = {x: 0, y: 0}) {
        super(position);
        this.sprite = 'images/enemy-bug.png';
        this.movement = movement;
    }

    update(dt) {
        this.move(this.movement, dt);
    }
}

class Player extends Entity {
    constructor(position = {x: 0, y: 0}, level) {
        super(position);
        this.sprite = 'images/char-boy.png';
        this.level = level;
    }

    update(input) {
        if (input == 'left') {
            this.shiftPosition({x: -this.level.tileWidth, y: 0});
        }
        else if (input == 'right') {
            this.shiftPosition({x: this.level.tileWidth, y: 0});
        }
        else if (input == 'up') {
            this.shiftPosition({x: 0, y: -this.level.tileHeight});
        }
        else if (input == 'down') {
            this.shiftPosition({x: 0, y: this.level.tileHeight});
        }
        // Ensure player does not move off the edge of the level
        this.pos.x = Math.max(0, this.pos.x);
        this.pos.y = Math.max(0, this.pos.y);
        this.pos.x = Math.min(this.pos.x, this.level.widthPixels() - this.level.tileWidth);
        this.pos.y = Math.min(this.pos.y, this.level.heightPixels() - this.level.tileHeight);
    }
}

class Entities {
    constructor(level) {
        this.enemies = [];
        this.player = new Player(level.start, level);
        this.level = level;
    }

    // Returns true if the game
    update(dt) {
        this.checkEnemyCreation(dt);
        this.checkEnemyRemoval();
        this.enemies.forEach(enemy => enemy.update(dt));
        const collisionOccurred = this.checkCollisions();
        return !collisionOccurred;
    }

    checkEnemyCreation(dt) {
        const ENEMY_CREATION_CHANCE = 0.5;
        if (Math.random() < dt * ENEMY_CREATION_CHANCE) {
            // don't create enemies in top or bottom rows
            const row = Math.floor(Math.random() * 3 + 1);
            // place enemies at either the left or right edge of screen
            // and set their movement to travel to the other side
            if (Math.random() < 0.5) {
                this.enemies.push(new Enemy({x: -this.level.tileWidth, y: row * this.level.tileHeight}, {x: 100, y: 0}));
            } else {
                this.enemies.push(new Enemy({x: this.level.widthPixels() + this.level.tileWidth, y: row * this.level.tileHeight},
                 {x: -100, y: 0}));
            }
        }
    }

    checkEnemyRemoval() {
        let toBeRemoved = -1;
        do {
            toBeRemoved = -1;
            for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex++) {
                let removeEnemy = false;
                const enemyToCheck = this.enemies[enemyIndex];
                if (enemyToCheck.x <= -this.level.tileWidth && enemyToCheck.movement.x < 0) removeEnemy = true;
                if (enemyToCheck.x >= this.level.widthPixels() && enemyToCheck.movement.x > 0) removeEnemy = true;
                if (removeEnemy) {
                    toBeRemoved = enemyIndex;
                    break;
                }
            }
            if (toBeRemoved >= 0) {
                this.enemies.splice(toBeRemoved, 1);
            }
        } while (toBeRemoved >= 0);
    }

    // Returns true if there is a collision between the player and an enemy,
    // and false otherwise
    checkCollisions() {
        for (let enemy of this.enemies) {
            const distance = Math.hypot(this.player.pos.x - enemy.pos.x, this.player.pos.y - enemy.pos.y);
            // 0.6 here is just determined by manual testing
            // to be the furthest distance that will only ever trigger
            // when the sprites are visually touching
            if (distance < this.level.tileWidth * 0.6) return true;
        }
        return false;
    }
}

class InputHandler {
    constructor(entities) {
        this.entities = entities;
        this.allowedKeys = {
            37: 'left',
            38: 'up',
            39: 'right',
            40: 'down'
        };
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const that = this;
        document.addEventListener('keyup', e => {
            const keyValue = that.allowedKeys[e.keyCode];
            if (keyValue) that.entities.player.update(keyValue);
        });
    }

    isPressed(keyValue) {
        return this.pressedKeys.includes(keyValue);
    }
}