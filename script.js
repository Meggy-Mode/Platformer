const canvas = document.getElementById('gameView');
const ctx = canvas.getContext('2d');
let colorOfCurrentBlock = null;
let blockChanged = false;
let currentLevel = 1;
let levelStartTime = 0
let levelTime = 0; // Initialize the level timer
let levelLoaded = false;
let maxLevel = 3; //Total levels -1
let levelFile = "blocks.json";
let playerStarted = false;
let levelTransitioning = false; // Added to prevent multiple level transitions
setTimeout(() => {
  levelLoaded = true;
  console.log("Loaded Level")
}, 800);



class Player {
  constructor(name, size, color, padding) {
    this.speed = 5;
    this.name = name;
    this.size = size;
    this.color = color;
    this.padding = padding
    this.x = 0;
    this.y = canvas.height / 2 - size / 2;
    this.verticalVelocity = 0;
    this.horizontalVelocity = 0;
    this.isGrounded = true;
    this.activeTimeouts = []; // Track active timeouts
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - cameraX, this.y, this.size, this.size);
  }
  
update(keys, blocks) {
    if (levelLoaded) {
        if ((keys['w'] || keys['a'] || keys['d'] || keys[' ']) && !playerStarted) {
            levelStartTime = Date.now();
            playerStarted = true;
        }

        if (keys['w'] && this.isGrounded) {
            this.verticalVelocity = colorOfCurrentBlock === 'lime' ? -10 : -8;
            this.isGrounded = false;
        }
        
        this.horizontalVelocity = (keys['a'] ? -this.speed : 0) + (keys['d'] ? this.speed : 0);
    }
    
    if (!this.isGrounded) {
        this.verticalVelocity += 0.5;
    }
    
    // Apply vertical movement first and check for ceiling/floor collisions
    this.y += this.verticalVelocity;
    
    // Check for ceiling collisions (hitting bottom of blocks)
    blocks.forEach(block => {
        if (!block.solid) return;
        
        const blockBottom = block.position.y + block.height;
        const blockTop = block.position.y;
        
        // Check if player is hitting the ceiling (bottom of a block)
        if (
            this.x < block.position.x + block.width &&
            this.x + this.size > block.position.x &&
            this.y < blockBottom &&
            this.y + this.size > blockTop &&
            this.verticalVelocity < 0 // Moving upward
        ) {
            // Hit ceiling
            //this.y = blockBottom;
            this.verticalVelocity = 0;
            
            if (block.color === 'black') {
                this.resetPlayer();
                return;
            }
        }
    });
    
    // Check for floor collisions
    if (this.y + this.size >= canvas.height) {
        //this.y = canvas.height - this.size;
        this.verticalVelocity = 0;
        this.isGrounded = true;
    }

    let intendedX = this.x + this.horizontalVelocity;
    let collisionDetected = false, onBlock = false;

    blocks.forEach(block => {
        if (!block.solid) return;
        
        const belowBlockTop = block.position.y;
        const aboveBlockBottom = block.position.y + block.height;

        // Horizontal collision check (walls)
        if (
            intendedX < block.position.x + block.width &&
            intendedX + this.size > block.position.x &&
            this.y < aboveBlockBottom &&
            this.y + this.size > belowBlockTop
        ) {
            collisionDetected = true;
            
            if (block.color === 'black') {
                this.resetPlayer();
                return;
            }
            
            if (block.color === 'yellow') {
                this.verticalVelocity = 0.5;
                this.isGrounded = true;
            }
            
            /*this.x = this.horizontalVelocity > 0 
                ? block.position.x - this.size 
                : block.position.x + block.width;*/
        }
        
        // Floor collision check (landing on top of blocks)
        if (
            this.x < block.position.x + block.width &&
            this.x + this.size > block.position.x &&
            this.y + this.size <= belowBlockTop + Math.abs(this.verticalVelocity) + 1 &&
            this.y + this.size >= belowBlockTop &&
            this.verticalVelocity >= 0 // Moving downward or stationary
        ) {
            if (['grey', 'lime', 'black'].includes(block.color)) {
                
                const previousColor = colorOfCurrentBlock;
                colorOfCurrentBlock = block.color;
                if (block.color === 'black') {
                    this.resetPlayer();
                    return;
                }
                if (block.color === 'grey' && previousColor !== 'grey') {
                    this.speed = 8;
                    blockChanged = true;
                }

            }
            
            //this.y = belowBlockTop - this.size;
            this.verticalVelocity = 0;
            this.isGrounded = true;
            onBlock = true;
        }
    });

    if (!collisionDetected && !onBlock) {
        this.isGrounded = false;
        if (blockChanged) {
            blockChanged = false;
            const currentBlockColor = colorOfCurrentBlock;
            const timeoutId = setTimeout(() => {
                if (currentBlockColor === 'grey') this.speed = 5;
                if (currentBlockColor === 'lime') {
                    this.verticalVelocity = 5;
                    this.isGrounded = true;
                }
            }, currentBlockColor === 'grey' ? 2000 : 20);
            this.activeTimeouts.push(timeoutId);
        }
    }
    
    if (!collisionDetected) {
        this.x = intendedX;
    }
    
    //this.x = Math.max(0, Math.min(this.x, mapWidth - this.size));
}

  resetPlayer() {
    // Clear all active timeouts
    this.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.activeTimeouts = [];
    
    this.x = 0;
    this.y = canvas.height / 2 - this.size / 2; // Fixed: was player.size
    this.verticalVelocity = 0;
    this.horizontalVelocity = 0;
    this.isGrounded = false;
    this.speed = 5; // Reset speed
    colorOfCurrentBlock = 'none';
    console.log("Player reset to (0, 0)");
  }
}

class Flag {
  constructor(id, color, position, size, texture) {
    this.id = id;
    this.color = color;
    this.position = position; // { x: ..., y: ... }
    this.size = size;
    this.texture = new Image();
    this.texture.src = texture; // Load the texture image
    this.loaded = false;

    this.texture.onload = () => {
      this.loaded = true; // Mark the texture as loaded
    };
  }

  draw() {
    if (this.loaded) {
      ctx.drawImage(this.texture, this.position.x - cameraX, this.position.y, this.size, this.size);
    } else {
      ctx.fillStyle = this.color; // Fallback to solid color
      ctx.fillRect(this.position.x - cameraX, this.position.y, this.size, this.size);
    }
  }

  checkCollision(player) {
    return (
      player.x < this.position.x + this.size &&
      player.x + player.size > this.position.x &&
      player.y < this.position.y + this.size &&
      player.y + player.size > this.position.y
    );
  }
}

class Shadow {
  constructor(name, size, color, padding) {
    this.name = name;
    this.size = size;
    this.color = color;
    this.x = 0;
    this.y = 0;
    this.padding = padding
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - cameraX, this.y, this.size, (this.size + 5));
  }

  followPlayer(px, blocks) {
    this.x = px + (15 - this.padding); // Always match player's X position
    let groundY = canvas.height; // Start at canvas bottom
    // Always place shadow on the detected ground level (or canvas bottom if no block found)
    this.y = groundY - this.size;

    blocks.forEach((block) => {
      if (block.solid) {
        const blockTop = block.position.y;
        const blockLeft = block.position.x - this.size;
        const blockRight = block.position.x + block.width;

        // Check if the shadow is above this block
        if (this.x >= blockLeft && this.x <= blockRight) {
          if (blockTop < groundY) {
            groundY = blockTop; // Update ground position
          }
        }
      }
    });

  }
}


let keys = {};
const player = new Player("P1", 15, 'blue', 0);
const shadow = new Shadow("P1 Shadow", 1, 'grey', 1)
const shadow2 = new Shadow("P1 Shadow", 1, 'grey', 2)
const shadow3 = new Shadow("P1 Shadow", 1, 'grey', 3)
const shadow4 = new Shadow("P1 Shadow", 1, 'grey', 4)
const shadow5 = new Shadow("P1 Shadow", 1, 'grey', 5)
const shadow6 = new Shadow("P1 Shadow", 1, 'grey', 6)
const shadow7 = new Shadow("P1 Shadow", 1, 'grey', 7)
const shadow8 = new Shadow("P1 Shadow", 1, 'grey', 8)
const shadow9 = new Shadow("P1 Shadow", 1, 'grey', 9)
const shadow10 = new Shadow("P1 Shadow", 1, 'grey', 10)
const shadow11 = new Shadow("P1 Shadow", 1, 'grey', 11)
const shadow12 = new Shadow("P1 Shadow", 1, 'grey', 12)
const shadow13 = new Shadow("P1 Shadow", 1, 'grey', 13)
const shadow14 = new Shadow("P1 Shadow", 1, 'grey', 14)
const shadow15 = new Shadow("P1 Shadow", 1, 'grey', 15)


let otherBlocks = [];
let flags = [];
const blockImages = [];

// Camera properties
let cameraX = 0; // X position of the camera
const mapWidth = 2000; // Width of the map
// Removed unused cameraSpeed variable

function drawOtherBlocks() {
  otherBlocks.forEach(block => {
    const img = blockImages[block.id];

    // Check if the block has a texture
    if (block.hasTexture && img.complete && block.level === currentLevel) {
      ctx.drawImage(img, block.position.x - cameraX, block.position.y, block.width, block.height);
    } else if (block.level === currentLevel) {
      // Use the backup color if there's no texture or the image is not loaded
      ctx.fillStyle = block.color;
      ctx.fillRect(block.position.x - cameraX, block.position.y, block.width, block.height);
    }
  });
}


function changeFile() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0]; // Access the selected file

  if (file) {
    const reader = new FileReader();

    reader.onload = function(event) {
      try {
        const jsonData = JSON.parse(event.target.result); // Parse JSON content
        const blocks = jsonData.blocks; // Assume the structure has a "blocks" property

        if (Array.isArray(blocks)) {
          // Update levelFile and otherBlocks for the current level
          levelFile = file.name;
          console.log("Changed file to " + levelFile);

          // Filter blocks for the current level
          otherBlocks = blocks.filter(block => block.level === currentLevel);
          loadBlockTextures(otherBlocks); // Load textures for the blocks
          maxLevel = 0

          console.log("Blocks successfully updated for the current level.");
        } else {
          throw new Error("Invalid JSON format: 'blocks' must be an array.");
        }
      } catch (error) {
        console.error("Error parsing JSON data:", error);
      }
    };

    reader.onerror = function() {
      console.error("Error reading the file.");
    };

    reader.readAsText(file); // Read the file as text
  } else {
    console.log("No file selected.");
  }
}

function drawFlags() {
  flags.forEach(flag => {
    flag.draw();
  });
}

function goToNextLevel() {
  if (currentLevel > maxLevel) {
    currentLevel = 1;
  } else {
    currentLevel += 1;
  }
  levelLoaded = false;

  setTimeout(() => {
    levelLoaded = true;
    console.log("Loaded Level");
  }, 800);

  loadBlocksForCurrentLevel();
  console.log("Level completed! Going to the next level...", "\nCompleted in: ", levelTime, " seconds");

  // Reset player position for the next level
  player.x = 0;
  player.y = canvas.height / 2 - player.size / 2;
  player.verticalVelocity = 0;
  player.horizontalVelocity = 0;
  player.isGrounded = false;
  player.speed = 5; // Reset speed
  colorOfCurrentBlock = null; // Reset block color
  
  // Clear any active timeouts
  player.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  player.activeTimeouts = [];

  console.log(`Now at level ${currentLevel}`);
}

function loadBlocksForCurrentLevel() {
  fetch(levelFile)
    .then(response => response.json())
    .then(data => {
      const blocks = data.blocks;
      if (!Array.isArray(blocks)) {
        throw new Error('Expected blocks to be an array');
      }

      // Filter blocks for the new level
      otherBlocks = blocks.filter(block => block.level === currentLevel);
      loadBlockTextures(otherBlocks); // Load the textures for the filtered blocks
    })
    .catch(error => console.error('Error loading block data:', error));
}

let lastUpdateTime = 0; // Time of the last update
const updateInterval = 15; // Update every 15 milliseconds

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  shadow.followPlayer(player.x, otherBlocks)
  shadow2.followPlayer(player.x, otherBlocks)
  shadow3.followPlayer(player.x, otherBlocks)
  shadow4.followPlayer(player.x, otherBlocks)
  shadow5.followPlayer(player.x, otherBlocks)
  shadow6.followPlayer(player.x, otherBlocks)
  shadow7.followPlayer(player.x, otherBlocks)
  shadow8.followPlayer(player.x, otherBlocks)
  shadow9.followPlayer(player.x, otherBlocks)
  shadow10.followPlayer(player.x, otherBlocks)
  shadow11.followPlayer(player.x, otherBlocks)
  shadow12.followPlayer(player.x, otherBlocks)
  shadow13.followPlayer(player.x, otherBlocks)
  shadow14.followPlayer(player.x, otherBlocks)
  shadow15.followPlayer(player.x, otherBlocks)

  shadow.draw();
  shadow2.draw();
  shadow3.draw();
  shadow4.draw();
  shadow5.draw();
  shadow6.draw();
  shadow7.draw();
  shadow8.draw();
  shadow9.draw();
  shadow10.draw();
  shadow11.draw();
  shadow12.draw();
  shadow13.draw();
  shadow14.draw();
  shadow15.draw();
  player.draw();
  drawOtherBlocks();
  drawFlags(); // Draw flags here
}

function loadBlockTextures(blocks) {
  blocks.forEach(block => {
    if (block.level === currentLevel) {
      const img = new Image();
      img.src = block.texture;
      blockImages[block.id] = img;
    }
  });
}

function loadFlags() {
  return fetch('flags.json')
    .then(response => response.json())
    .then(data => {
      data.flags.forEach(flagData => {
        const flag = new Flag(
          flagData.id,
          flagData.color,
          flagData.position,
          flagData.size,
          flagData.texture // Pass the texture property
        );
        flags.push(flag);
      });
    })
    .catch(error => console.error('Error loading flag data:', error));
}


function update() {
  const currentTime = Date.now();
  if (currentTime - lastUpdateTime >= updateInterval) {
    player.update(keys, otherBlocks);
    if (playerStarted == true) {
      levelTime = parseFloat((Date.now() - levelStartTime) / 1000); // Calculate the elapsed time in seconds
    }
    
    // Check for collision with flags (with cooldown to prevent multiple transitions)
    flags.forEach(flag => {
      if (flag.checkCollision(player) && !levelTransitioning) {
        levelTransitioning = true; // Prevent multiple transitions
        playerStarted = false
        document.getElementById("compleated-level").innerText = currentLevel;
        document.getElementById("time-stamp").innerText = levelTime;
        goToNextLevel(); // Call the level transition function
        levelTime = 0;
        levelStartTime = Date.now(); // Reset the level start time
        
        // Reset transition flag after delay
        setTimeout(() => {
          levelTransitioning = false;
        }, 1000);
      }
    });

    // Update cameraX based on player's horizontal position
    cameraX = player.x - canvas.width / 2 + player.size / 2;
    cameraX = Math.max(0, Math.min(cameraX, mapWidth - canvas.width));

    lastUpdateTime = currentTime; // Update the last update time
  }
}

function gameLoop() {
  document.getElementById('time').innerText = levelTime
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function isPointInSquare(point, square) {
  return (
    point.x >= square.x - cameraX &&
    point.x <= square.x + square.size - cameraX &&
    point.y >= square.y &&
    point.y <= square.y + square.size
  );
}

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

document.addEventListener('keydown', (event) => {
  keys[event.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

// Global declarations
Promise.all([
  fetch(levelFile).then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  }),
  loadFlags()
])
  .then(data => {
    const blocks = data[0].blocks; // Accessing the blocks array from the first promise
    if (!Array.isArray(blocks)) {
      throw new Error('Expected blocks to be an array');
    }

    // Filter blocks based on the current level
    otherBlocks = blocks.filter(block => block.level === currentLevel);
    loadBlockTextures(otherBlocks);
    console.log(otherBlocks); // Verify the blocks being loaded
    gameLoop();
  })
  .catch(error => console.error('Error loading block data:', error));
