class MainScene extends Phaser.Scene { 
  preload() {
    this.load.image("frog", "images/Frog_rest.png");
    this.load.image("lilipad", "images/lilipad.png");
    this.load.image("bug", "images/bug.png")
  }

  /* next seed, called after 1 second or if frog reaches bug */
  nextIteration() {
    this.iteration += 1;
    this.iterationStart = performance.now();
    
    this.resetmap();

    this.postdata(this.gridvalues, this.nnreward);

    this.currdecision = null;
  }

  /* clear out all old data and repositions frog */ 
  resetmap() {
    if (this.lilipads) {
      for (const sprite of this.lilipads) {
        sprite.destroy();
      }
    }
    this.lilipads = [];
    this.gridvalues = [];
    this.frogrow = 0;
    this.frogcol = 0;
    for (let r = 0; r < this.gridsize; r++) {
      const row = [];
      for (let c = 0; c < this.gridsize; c++) {
        if (r === 0 && c === 0) {
          row.push("F");
        } else {
          row.push("X");
        }
      }
      this.gridvalues.push(row);
    }
    this.grid = this.buildgrid(this.gridsize, this.cellsize);
    const startpos = this.getcellcenter(this.frogrow, this.frogcol);
       this.frog.setPosition(startpos.x, startpos.y);


    this.perlinlilipads();
     this.drawpath();
    this.currdecision = null;

    this.nnreward = 0;
  }
  
  create() {
    this.gridvalues = [];
    this.gridsize = 10;
    this.cellsize = 50;
    this.frogrow = 0;
    this.frogcol = 0;
    this.stuckcount = 0;
    this.iteration = 1;
    this.iterationStart = performance.now();
    this.iterationDuration = 1000;
    this.lastdecision = "?";

    this.movecounter = 0;
    this.topcounter = 0;

    /** to evaluate NN's choice */
    this.nnreward = 0;

    /* initialize grid values w/ frog at 0,0 */
    this.gridvalues = [];
    for (let r = 0; r < this.gridsize; r++) {
      const row = [];
      for (let c = 0; c < this.gridsize; c++) {
        if (r === 0 && c === 0) {
          row.push("F");
        } else {
          row.push("X");
        }
      }
      this.gridvalues.push(row);
    }

    this.grid = this.buildgrid(this.gridsize, this.cellsize);

    const startpos = this.getcellcenter(this.frogrow, this.frogcol);
    this.gridvalues[this.frogrow][this.frogcol] = "F";
    this.frog = this.add.sprite(startpos.x, startpos.y, "frog");

    this.frog.setScale(0.1);
    this.frog.setDepth(1);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.adKeys = this.input.keyboard.addKeys("A,D,W,S");
    this.paused = false;
    this.pause = this.add.text(20, 20, "Pause", {color: "#ffffff", backgroundColor: "#000000", padding: 6})
      .setInteractive({useHandCursor: true})

      
      .on("pointerdown", () => {
        this.paused = !this.paused;
        this.pause.setText(this.paused ? "Play" : "Pause");
      })
      .setDepth(2);



    this.hudText = this.add.text(20, 80, "Decision: ?, Reward: 0", { color: "#ffffff", backgroundColor: "#000000", padding: 6 }).setDepth(2);
    this.iterText = this.add.text(20, 140, "Iteration: 1", { color: "#ffffff", backgroundColor: "#000000", padding: 6 }).setDepth(2);
    this.timerText = this.add.text(20, 170, "Time left: 10.0s", { color: "#ffffff", backgroundColor: "#000000", padding: 6 }).setDepth(2);

    this.printgrid();
    this.perlinlilipads();
    this.drawpath();

    /* send initial grid to NN and let it make a decision */
    this.postdata(this.gridvalues, this.nnreward);

    this.currdecision = null;
  }

  update() {
    if (this.paused) return;
    if (!this.currdecision) return;
    const now = performance.now();
    if (!this.lastTick) this.lastTick = now;
    const delta = now - this.lastTick;
    if (delta < 5) return;
    this.lastTick = now;
     const decision = this.currdecision;
    const moved = this.movefrog(this.currdecision);
    this.lastdecision = decision || "?";
    this.currdecision = null;
    this.postdata(this.gridvalues, this.nnreward);
    const elapsed = now - this.iterationStart;
    const remaining = Math.max((this.iterationDuration - elapsed) / 1000, 0).toFixed(1);
    this.timerText.setText(`Time left: ${remaining}s`);
    if (elapsed >= this.iterationDuration) {
      this.nextIteration();
      return;
    }
    this.hudText.setText(`Decision: ${this.lastdecision || "?"}, Reward: ${this.nnreward.toFixed(3)}`);
    this.iterText.setText(`Iteration: ${this.iteration}`);
  }
  


  /* perlin noise for lilipad generation
    credit: https://joeiddon.github.io/projects/javascript/perlin.html
   */
  perlinlilipads() {
    this.lilipads = [];
  
    const frequency = 0.3;
    const threshold = 0.6;
    for (let r = 0; r < this.gridsize; r++) {
      for (let c = 0; c < this.gridsize; c++) {
        if (r === this.frogrow && c === this.frogcol) {
          continue;
        }
        const n = this.noisehelper(r * frequency, c * frequency);
        if (n > threshold) {
          this.gridvalues[r][c] = "P";
          const pos = this.getcellcenter(r, c);
          const pad = this.add.sprite(pos.x, pos.y, "lilipad").setScale(0.05);
          pad.setDepth(0.5);
          this.lilipads.push(pad);
        }
      }
    }
  }

  /* perline noise helper */
  noisehelper(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7);
    const t = Math.sin(x * 269.5 + y * 183.3);
    const val = (Math.sin(s + t) + 1) / 2;
    return val;
  }

  /* assures that a possible path exists for frog. 
    Makes last lilipad in path have "bug" (the goal) */
  drawpath() {
    if (!this.lilipads) this.lilipads = [];
    let curr_row = this.frogrow;
    let curr_col = this.frogcol;
    while (curr_col < this.gridsize - 1) {
      const next_col = curr_col + 1;

      const choices = [];
      if (curr_row - 1 >= 0) {
        choices.push(curr_row - 1);
      }
      choices.push(curr_row);
      if (curr_row + 1 < this.gridsize) {
        choices.push(curr_row + 1);
      }

      let new_row = curr_row;
      if (this.gridvalues[curr_row][next_col] !== "P") {
        const pick = Math.floor(Math.random() * choices.length);
        new_row = choices[pick];
      }

      if (new_row !== curr_row && this.gridvalues[new_row][curr_col] !== "P") {
        const posvert = this.getcellcenter(new_row, curr_col);

        /* make sure final column has the bug */
        if (curr_col == 9) {
          this.gridvalues[new_row][curr_col] = "B";
          console.log("final column!");
          const bugvert = this.add.sprite(posvert.x, posvert.y, "bug").setScale(0.05);
          bugvert.setDepth(1);
          this.lilipads.push(bugvert);
        } else {
          this.gridvalues[new_row][curr_col] = "P";
          const padvert = this.add.sprite(posvert.x, posvert.y, "lilipad").setScale(0.05);
          padvert.setDepth(0.5);
          /* last column */
          this.lilipads.push(padvert);
        }
      }
      
      if (this.gridvalues[new_row][next_col] !== "P") {
        const lastcol = next_col === this.gridsize - 1;
        this.gridvalues[new_row][next_col] = lastcol ? "B" : "P";
        const posnext = this.getcellcenter(new_row, next_col);
        if (lastcol) {
          const pad = this.add.sprite(posnext.x, posnext.y, "lilipad").setScale(0.05);
          pad.setDepth(0.5);
          this.lilipads.push(pad);
          const bugnext = this.add.sprite(posnext.x, posnext.y, "bug").setScale(0.05);
          bugnext.setDepth(1);
          this.lilipads.push(bugnext);
        } else {
          const padnext = this.add.sprite(posnext.x, posnext.y, "lilipad").setScale(0.05);
          padnext.setDepth(0.5);
          this.lilipads.push(padnext);
        }
      }

      curr_row = new_row;
      curr_col = next_col;
    }
    this.placebug();
  }

  
  movefrog(direction) {
    
    let newrow = this.frogrow;
    let newcol = this.frogcol;

    /* clamp within the grid */
    if (direction === "back") {
      newcol = Math.max(0, this.frogcol - 1);
    }
    if (direction === "forward") { 
      newcol = Math.min(this.gridsize - 1, this.frogcol + 1);
    }
    if (direction === "down") {
      newrow = Math.min(this.gridsize - 1, this.frogrow + 1);
    }
    if (direction === "up") {
      newrow = Math.max(0, this.frogrow - 1);
    }

    if (newrow === this.frogrow && newcol === this.frogcol) {
      this.nnreward = -1;
      return false;
    }

    if (this.gridvalues[newrow][newcol] !== "P" && this.gridvalues[newrow][newcol] !== "B") {
      this.nnreward = -1;
      return false;
    }

    /* clear old pos and update grid values */
    const oldrow = this.frogrow;
    const oldcol = this.frogcol;
    const bugreached = this.assessNN(oldcol, oldrow, newcol, newrow);
    if (bugreached) {
      return true;
    }
    this.gridvalues[oldrow][oldcol] = "P";
    this.frogrow = newrow;
    this.frogcol = newcol;
    this.gridvalues[this.frogrow][this.frogcol] = "F";

    /* rebuild grid visuals */
    this.grid = this.buildgrid(this.gridsize, this.cellsize);
    const { x, y } = this.getcellcenter(this.frogrow, this.frogcol);
    this.frog.setPosition(x, y);
    return true;
  }

  /** posts the grid of water, lilipads and frog location 
   * as string sequence, which is 
   * then converted into a tensor (0 = water, 1 = frog, 2 = lilipad) 
   * and fed into NN that provides weights for 
   * four values: Up, Back, Down, Forward (WASD)
   */
  async postdata(data, reward){
    
      const response = await fetch(`http://localhost:8000/grid`, {
        method: "POST",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({
          grid: data,
          reward: reward
        })
      });
      if (!response.ok) {
        console.error("postdata http error", response.status, response.statusText);
        return;
      }
      const json = await response.json();
      if (json && json.action) {
        this.currdecision = json.action;
      }
     
  }

 

  /* secondary evaluation for reward (pixel dist fromg frog) */
  distfrombug() {
    let bugrow = null;
    let bugcol = null;
    for (let r = 0; r < this.gridsize; r++) {
      for (let c = 0; c < this.gridsize; c++) {
        if (this.gridvalues[r][c] === "B") {
          bugrow = r;
          bugcol = c;
          break;
        }
      }
      if (bugrow !== null) break;
    }
    if (bugrow === null || bugcol === null) return 0;
    const bugpos = this.getcellcenter(bugrow, bugcol);
    const dx = this.frog.x - bugpos.x;
    const dy = this.frog.y - bugpos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxdist = Math.sqrt(Math.pow((this.gridsize - 1) * this.cellsize, 2) * 2);
    const norm = 1 - Math.min(dist / maxdist, 1);
    return norm;
  }

  buildgrid(size, cellsize) {
    /* destroy old grid visuals */
    if (this.grid) {
      for (const row of this.grid) {
        for (const cell of row) {
          cell.destroy();
        }
      }
    }
    const grid = [];
    this.gridorigin = {x: 150, y: 50};

    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        const x = 150 + c * cellsize;
        const y = 50 + r * cellsize;
        const cell = this.add.rectangle(x, y, cellsize - 1, cellsize - 1, 0x2255aa).setOrigin(0);
        row.push(cell);
      }
      grid.push(row);
    }
    this.printgrid();
    return grid;
  }

  getcellcenter(row, col) {
    let x =  this.gridorigin.x + col * this.cellsize + this.cellsize / 2;
    let y = this.gridorigin.y + row * this.cellsize + this.cellsize / 2;
    return {x, y};
  }
 
  /** web-console use only */
  printgrid(){
    console.table(this.gridvalues);
  }

  assessNN(oldx, oldy, newx, newy) {
    const closeness = this.distfrombug();
    /** time penalty */
    this.nnreward -= 0.01
    /* landed on bug. Bro won! */
    if(this.gridvalues[newy][newx] === "B"){
      this.nnreward = 5.0;
      this.nextIteration();
      return true;
    }
    /* didn't move, penalize */
    else if(newx === oldx && newy === oldy) {
      console.log("didnt move");
      this.nnreward = -0.5 + closeness * 0.1;
      return false;
    }
    /* vertical movement, better! */
    else if(newx === oldx && newy != oldy) {
      console.log("moved vertically");
      this.nnreward = 0.2 + closeness * 0.1;
      return false;
    }
    /* moved forward. even better */
    else if(newx > oldx) {
      console.log("moved forwards");
      this.nnreward = 0.3 + closeness * 0.1;
      return false;
    }
    /* moved backwards, punish */
    else if(newx <= oldx) {
      console.log("moved backwards");
      this.nnreward = -0.5 + closeness * 0.1;
      return false;
    }
    return false;
  }

  /* if could not place bug in last lilipad of 'drawpath', put it on at least some lilipad. */
  placebug() {
    const lastcol = this.gridsize - 1;
    if (!this.lilipads) this.lilipads = [];
    for (const sprite of this.lilipads) {
      if (sprite.texture && sprite.texture.key === "bug") {
        sprite.destroy();
      }
    }
    this.lilipads = this.lilipads.filter((s) => s && s.active);
    for (let r = 0; r < this.gridsize; r++) {
      for (let c = 0; c < this.gridsize; c++) {
        if (this.gridvalues[r][c] === "B" && c !== lastcol) {
          this.gridvalues[r][c] = "P";
        }
      }
    }
    let bugrow = null;
    for (let r = 0; r < this.gridsize; r++) {
      if (this.gridvalues[r][lastcol] === "B") {
        bugrow = r;
        break;
      }
    }
    if (bugrow === null) {
      for (let r = 0; r < this.gridsize; r++) {
        if (this.gridvalues[r][lastcol] === "P" || this.gridvalues[r][lastcol] === "X") {
          bugrow = r;
          break;
        }
      }
    }
    if (bugrow === null) bugrow = 0;
    const lastcolind = this.gridsize - 1;
    this.gridvalues[bugrow][lastcolind] = "B";
    const pos = this.getcellcenter(bugrow, lastcolind);
    const pad = this.add.sprite(pos.x, pos.y, "lilipad").setScale(0.05);
    pad.setDepth(0.5);
    const bug = this.add.sprite(pos.x, pos.y, "bug").setScale(0.05);
    bug.setDepth(1);
    this.lilipads.push(pad, bug);
  }
}

window.addEventListener("load", () => {
  const GAME_CONFIG = { ...(window.GAME_CONFIG_BASE || {}), scene: MainScene};
  new Phaser.Game(GAME_CONFIG);
});
