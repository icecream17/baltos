///// SETTINGS /////
const SIZE = 5

const A_STAR_MEMORY = 50_000
const A_STAR_PRUNE = false
const A_STAR_STAGE = true
const A_STAR_MAX = true // search at 1 move per move (2 cells progress)

const SETUP_MOVES = `

`.trim()



///// STATS /////
const GLOBAL_BEST = [
   null, null, 5, 27, 76, // 0 - 4
   160, 299, 486, 785, 1132, // 5 - 9
   1612, 2182, 2756, 3574, 4434, // 10 - 14
   5522, 6720, 8064, 9604, 11200, // 15 - 19
   12904, 15490, 17640, 19968, 22924, // 20 - 24
   25872, 29102, 32582, // 25 - 27
][SIZE]
const MY_BEST = [
   null, null, 5, 31, 100,
   258, 552, 759, 1265, 1841,
][SIZE]





///// SETUP /////

const GRID = gridFromString(board(SIZE))
let ZERO = getZero()
let CURRENT_SCORE = ""
let CURRENT_MOVES = ""

function main() {
   updateScore()
   doAnswer(SETUP_MOVES)
   const startTime = Date.now()

   // Do something
   {
      starForce()
   }

   printGrid()
   console.log(CURRENT_SCORE)
   console.log(CURRENT_MOVES)
   console.log(Date.now() - startTime + 'ms')
}



///// API //////

///////////////// A* ////////////////

class PriorityQueue {
   constructor(capacity) {
      this.elements = [] // Elements are in reverse order!
      this.capacity = capacity
   }

   enqueue(priority, element) {
      // Index of the first element with smaller priority
      // Could be found by binary search, but no reason
      const i = this.elements.findIndex(({priority: p}) => p < priority)

      if (this.elements.length === this.capacity) {
         if (i > 0) {
            for (let j = 0; j < i - 1; j++) {
               this.elements[j] = this.elements[j + 1]
            }
            this.elements[i - 1] = {priority, element}
         }
      } else if (i === -1) {// no element is smaller, place at end
         this.elements.push({priority, element})
      } else {
         this.elements.splice(i, 0, {priority, element})
      }
   }

   dequeue() {
      return this.elements.pop(); // Remove and return the element with the lowest score
   }

   isEmpty() {
      return this.elements.length === 0;
   }

   isFull() {
      return this.elements.length === this.capacity;
   }
}

function starForce() {
   const pfs = updateScore()
   const starPruneFactor = A_STAR_MAX ? 1 : pfs / GLOBAL_BEST

   let lowestScore = getScore()
   let lowestMoves = CURRENT_MOVES
   let lowestHash = getHash()

   const priorityF = (score, moves) =>
      Math.floor(score) - pfs + moves.length * starPruneFactor
   const searchQ = new PriorityQueue(A_STAR_MEMORY)
   const addToQ = (score, moves, hash) => {
      // if (A_STAR_FAILS?.some(fail => moves.startsWith(fail))) {
      //    return
      // }

      // if it is possible (each move improves score by at most 1)
      let best_left = A_STAR_PRUNE ? GLOBAL_BEST - moves.length :
                      Math.floor(lowestScore) === 0 ? lowestMoves.length - moves.length : Infinity;
      if (Math.floor(score) <= best_left) {
         searchQ.enqueue(priorityF(score, moves), {score, moves, hash})
      }
   }
   addToQ(lowestScore, lowestMoves, lowestHash)
   //debug(JSON.stringify(searchQ.elements).replaceAll('\\n', '\n'), 1)

   let canReset = false
   let done = false
   function doStep(debug2) {
      if (searchQ.isEmpty()) {
         done = true
         console.debug("star done!", lowestScore, lowestMoves, lowestHash)
         return
      } else if (A_STAR_STAGE && searchQ.isFull()) {
         if (canReset) {
            canReset = false
            console.debug("reset!", lowestScore, lowestMoves)
            searchQ.elements.length = 0
            addToQ(lowestScore, lowestMoves, lowestHash)
         } else {
            searchQ.capacity *= 2
            console.debug(`^ capacity: ${searchQ.capacity}`, lowestScore, lowestMoves)
         }
      }

      const {score, moves, hash} = searchQ.dequeue().element
      load(hash, moves, score)
      for (const move of searchMoves()) {
         doMove(move)
         const moveScore = updateScore()
         const moveString = CURRENT_MOVES
         const moveHash = getHash()
         if (moveScore < lowestScore) {
            lowestScore = moveScore
            lowestMoves = moveString
            lowestHash = moveHash
            console.debug("new star!",
               searchQ.elements.length,
               priorityF(moveScore, moveString),
               moveScore,
               moveString
            )
            canReset = true
         }
         addToQ(moveScore, moveString, moveHash)
         undoMove()
      }
      debug2 && console.log(searchQ.elements.length, searchQ.elements.at(-1)?.priority, lowestScore)
   }

   for (let i = 0; !done; i++) {
      doStep(i % 0x100 === 0xFF)
   }
}

///////////////// MOVE ////////////////

const MOVES = "123456ABCDEF".split("")
const kind = {
   "1": true,
   "2": true,
   "3": true,
   "4": true,
   "5": true,
   "6": true,
   "A": false,
   "B": false,
   "C": false,
   "D": false,
   "E": false,
   "F": false,
}
const opposites = {
   "1": "C",
   "2": "D",
   "3": "E",
   "4": "F",
   "5": "A",
   "6": "B",
   A: "5",
   B: "6",
   C: "1",
   D: "2",
   E: "3",
   F: "4",
}
const offsets = [
   [[-1,0],[1,1],"1"],
   [[0,1],[1,0],"2"],
   [[1,1],[0,-1],"3"],
   [[1,0],[-1,-1],"4"],
   [[0,-1],[-1,0],"5"],
   [[-1,-1],[0,1],"6"],
   [[0,1],[-1,-1],"A"],
   [[1,1],[-1,0],"B"],
   [[1,0],[0,1],"C"],
   [[0,-1],[1,1],"D"],
   [[-1,-1],[1,0],"E"],
   [[-1,0],[0,-1],"F"],
]
const adjacentOffsets = offsets.slice(0,6).map(o => o[0])

function lastMove() {
   return CURRENT_MOVES.at(-1)
}

function isOpposite(move) {
   return move === opposites[lastMove()]
}

function isValid(move) {
   return kind[move] !== kind[lastMove()]
}

function searchMoves() {
   return MOVES.filter(m => isValid(m) && !isOpposite(m))
}

function filterOpposites(s) {
   let r = ""
   for (const char of s) {
      if (opposites[char] === r.at(-1)) {
         r = r.slice(0, -1)
      } else {
         r += char
      }
   }
   return r
}

function doMove(move) {
   if (move === undefined) throw "undefined move";

   const [oa, ob] = offsets.find(a => a[2] === move) // get offsets

   const _ = ZERO
   const a = get(untorus(add(_.coords, oa)))
   const b = get(untorus(add(a.coords, ob)))

   //console.debug(_.value, a.value, b.value)
   _.value = b.value
   b.value = a.value
   a.value = 0
   //console.debug("->", _.value, a.value, b.value)

   ZERO = a

   CURRENT_MOVES = filterOpposites(CURRENT_MOVES + move)
   updateScore()
}

function undoMove() {
   const lastChar = lastMove()
   if (lastChar) {
      doMove(opposites[lastChar])
   }
}

function doAnswer(ans) {
   if (ans === "") return;

   let hashes = [getHash()]
   ans = CURRENT_MOVES + ans

   for (let i = CURRENT_MOVES.length; i < ans.length; i++) {
      doMove(ans[i])
      const h = getHash()
      if (hashes.includes(h)) {
         CURRENT_MOVES = ans.slice(0, hashes.indexOf(h))
         ans = ans.slice(0, hashes.indexOf(h)) + ans.slice(i)
         i = hashes.indexOf(h)
         hashes = hashes.slice(0, i + 1) // hashes.length = 1 + ans::done.length
         updateScore()
         if (ans[i] !== undefined && !isValid(ans[i])) {
            throw `invalid??? ${i} ${ans[i]} ${h.slice(-2)}`
         }
      } else {
         hashes.push(h)
      }
   }
}




///////////////// SCORE ////////////////

function getScore() {
   return Number(CURRENT_SCORE)
}

function updateScore() {
   return Number(
      CURRENT_SCORE = score() + `.` +
         String(CURRENT_MOVES.length).padStart(6, '0')
   )
}

function score() {
   return scoreNonSolve()
}

function popSet(s) {
   for (const e of s) {s.delete(e); return e;}
}

function arrayEq(a, b) {
   return a === b ||
      a.length === b.length && a?.every?.((e,i)=>arrayEq(b[i],e))
}

// Let a group of incorrect cells be an island.
//
// This returns a lower bound on the time it takes for the
// empty cell to reach all the islands and return to the center.
//
// The lower bound calculated is the sum of the edges in the MST
// (minimum spanning tree) of the graph of islands.
// wrong : [passenger, destination, cost][]
function minSpanTreeLength(wrong, center=[SIZE-1,SIZE-1], empty=ZERO.coords, dist=torusDistance) {
   const inisle = new Set()
   const islands = []
   wrong.push([empty, center, dist(empty, center)])
   while (wrong.length) {
      // add island
      let island = new Set()
      let islandMerge = new Set()
      const toProcess = new Set()
      toProcess.add(wrong.pop()) // < assert

      // island = process neighbors of popWrong
      while (toProcess.size !== 0) {
         const wrp = popSet(toProcess)
         if (inisle.has(wrp)) { // note if island merge and skip
            islandMerge.add(islands.findIndex(isle => isle.has(wrp)))
            continue
         }
         island.add(wrp)
         for (const a of adjacent(wrp[0])) { // add adjacent to toProcess
            const adi = wrong.findIndex(w => arrayEq(w[0], a))
            if (adi !== -1) {
               const ad = wrong.splice(adi, 1)[0] // < assert
               // assert> !island.has(ad) because anything added to the island has been removed from wrong
               toProcess.add(ad)
            }
         }
      }

      // update inisle
      for (const wris of island) {
         inisle.add(wris)
      }

      // merge islands and add
      islandMerge = [...islandMerge].sort((a,b)=>a-b)
      while (islandMerge.length) {
         const imi = islandMerge.pop()
         const imisle = islands.splice(imi, 1)[0]
         island = island.union(imisle)
      }
      islands.push(island)
   }

   // Finally, remove islands and build the MST
   let mstl = 0
   const nodes = [islands.pop()]
   const distances = new Map(islands.map(isl => [isl,Infinity]))
   while (islands.length) {
      // calc distances from last added node
      const lastNode = nodes.at(-1)
      const lastNodeD = new Map(islands.map(
         isl => {
            let bestd = Infinity
            for (const cell of isl) {
               for (const cell2 of lastNode) {
                  const d = dist(cell[0], cell2[0])
                  if (d < bestd) {
                     bestd = d
                  }
               }
            }
            //if (bestd === Infinity) debug(isl.size, lastNode.size);
            return [isl, bestd]
         }
      ))
      // The closest island to any of the nodes is added
      let bestd = Infinity
      let bestisl = islands[0]
      for (const [isl, d] of distances) {
         const updatedD = Math.min(lastNodeD.get(isl), d)
         if (updatedD < bestd) {
            bestd = updatedD
            bestisl = isl
         }
         distances.set(isl, updatedD)
      }
      islands.splice(islands.indexOf(bestisl), 1)
      distances.delete(bestisl)
      nodes.push(bestisl)
      mstl += bestd
   }
   // debug2("mstl", mstl)
   return mstl
}

function scoreNonSolve() {
   let s = 0
   const dist = torusDistance
   const where = GRID.flat() // { index, coords, value }
   const center = [SIZE - 1, SIZE - 1]
   const centerIndex = where.findIndex(a => equal(a.coords, center))
   const wrong = []

   //console.debug(where)
   for (const [i, {coords}] of where.entries()) {
      if (i === centerIndex) continue;
      const reachedCenter = i >= centerIndex ? 1 : 0
      const iirc = i + (1-reachedCenter) // the number associated with the current cell
      let whereI
      try { whereI = where.find(a => a.value === iirc).coords } catch (e) {
         console.debug(where, where.length, iirc)
         throw e
      }
      const d = dist(whereI, coords) // whereI = rider, coords = goal
      if (d === 0) {
      } else {
         wrong.push([whereI, coords, d])
         s += d//1 + (d - 1)// ** 2
      }
   }

   s = Math.ceil(s/2)
   if (wrong.length) {
      s += minSpanTreeLength(wrong, center) * 2
   }

   return s
}



///////////////// HASH //////////////////

function getHash() {
   return GRID.map(row => row.map(cell => cell.value).join(","))
              .join("\n") + ":" + CURRENT_MOVES.length % 2
}

function updateFromHash(hash) {
   if (hash === undefined) throw "updateFromHash";
   for (const [a, row] of hash.split(":")[0].split("\n").entries()) {
      for (const [b, cellText] of row.split(",").entries()) {
         GRID[a][b].value = Number(cellText)
      }
   }
}

function load(hash, moveString, score) {
   updateFromHash(hash)
   ZERO = getZero()
   CURRENT_MOVES = moveString
   if (score === undefined) {
      updateScore()
   }
}



///////////////// CELL //////////////////

/** Converts raw column to space-column */
function col(i,j) {
   if (j === undefined) throw "col";
   const m = SIZE - 1
   if (i > m) return j + i - m;
   return j
}

/** Converts space-column to raw column */
function uncol(i,j) {
   if (j === undefined) throw "uncol";
   const m = SIZE - 1
   if (i > m) return j + m - i;
   return j
}

/*
   A B C
   L     D
   K       E
     J     F A B C
       I H G L     D
       A B C K       E
       L     D J     F
       K       E I H G
         J     F
           I H G
*/
function untorus([i,j]) {
   const m = SIZE - 1
   const l = SIZE + SIZE - 1
   if (i < 0) {
      i += l
      j += m
   } else if (l <= i) {
      i -= l
      j -= m
   }

   if (m <= i && j < i - m) {
      i -= l
      j -= m
      i += m
      j += l
      i ++
   } else if (j < 0) {
      i += m
      j += l
      i ++
   }

   if (i <= m && i + m < j) {
      i += l
      j += m
      i -= m
      j -= l
      i --
   } else if (j >= l) {
      i -= m
      j -= l
      i --
   }

   return [i,j]
}

function offset([a,b],[x,y]) {
   return [x-a, y-b]
}

function add([a,b],[x,y]) {
   return [a+x,b+y]
}

function equal_([a,b],[x,y]) {
   return a === x && b === y
}

function distance([a,b],[x,y]) {
   const d1 = a - x
   const d2 = b - y
   if (Math.sign(d1) === Math.sign(d2)) {
      const shared = Math.min(Math.abs(d1), Math.abs(d2))
      return Math.abs(d1) + Math.abs(d2) - shared
   }
   return Math.abs(d1) + Math.abs(d2)
}


function torusDistance(a, b) {
   const l = SIZE + SIZE - 1
   const m = SIZE - 1
   const torusOffsets = [
      [0, 0],
      [l, m], // 3
      [-l, -m], // 6
      [m-l+1, l-m], // 1 = 6 + 2
      [m+1, l], // 2
      [l-m-1, m-l], // 4 = 3 + 5
      [-m-1, -l], // 5
   ]

   return Math.min(...torusOffsets.map(o => distance(add(a,o),b)))
}

function equal(a,b) {
   return equal_(untorus(a), untorus(b))
}

function adjacent(a, b) {
   return adjacentOffsets.map(o => untorus(add(a, o)))
}

function isAdjacent(a, b) {
   return adjacentOffsets.some(o => equal(add(a, o), b))
}

function get([a,b]) {
   return GRID[a][uncol(a,b)]
}

/** Only used once */
function getZero() {
   for (const row of GRID) {
      for (const cell of row) {
         if (cell.value === 0) {
            return cell
         }
      }
   }
}



///////////////// GRID //////////////////

function gridFromString(str) {
   return str.split('\n').map((a,i) =>
      a.split(',').map((b,j) => ({
         index: [i, j],
         coords: [i, col(i, j)],
         value: +b
      })))
}

function printGrid() {
   const N = String(GRID.reduce((accum, curr) => accum + curr.length, 0)).length
   const M = SIZE - 1
   console.log(GRID.map((row, i) => {
      const r = row.map(cell => (cell.value === 0 ? '_' : String(cell.value)).padStart(N, '_'))
      const d = Math.abs(M - i)
      return " ".repeat(N * d) + r.join(' ')
   }).join("\n"))
}


function board(n) {
   switch (n) {
      // test value: one solution is A6E2E
      case 2: return `6,5
4,0,3
1,2`;
      case 3: return `15,13,8
14,17,9,16
10,18,0,4,12
3,7,2,5
11,6,1`;
      case 4: return `15,35,24,23
20,36,33,31,29
27,26,30,25,18,2
19,14,7,32,28,34,5
4,13,0,8,1,11
9,21,3,17,10
12,22,6,16`;
      case 5: return `40,49,42,53,12
54,55,46,22,43,37
41,48,50,60,47,59,28
57,3,15,0,45,27,36,13
17,39,2,25,52,20,19,56,58
5,26,23,4,24,35,21,44
33,16,29,14,9,31,7
34,11,32,10,30,6
8,1,38,18,51`;
      case 6: return `67,80,79,81,73,45
69,86,88,7,74,85,55
68,47,0,38,62,12,32,64
50,75,59,90,10,78,76,84,63
77,53,19,87,61,23,60,37,44,70
46,82,4,36,43,71,20,40,33,9,28
49,48,57,21,1,14,89,5,42,24
58,30,54,25,39,22,41,72,51
2,29,83,15,66,13,16,31
34,11,3,6,8,52,65
18,26,35,27,56,17`;
      case 7: return `79,113,115,114,98,116,36
104,95,110,83,52,118,84,117
80,96,10,89,123,124,122,47,106
111,82,86,105,26,45,109,60,119,65
76,125,120,20,62,58,56,59,11,16,38
30,100,78,12,97,93,67,0,9,39,107,27
102,14,81,108,101,68,70,126,55,121,103,22,53
28,3,90,61,29,88,46,6,72,37,77,17
34,63,94,66,35,91,43,85,31,75,44
42,54,24,1,25,40,74,50,69,112
92,64,73,7,21,4,32,71,15
33,8,2,51,18,23,49,5
87,99,19,57,48,13,41`;
      case 8: return `24,141,65,110,146,149,145,62
77,113,155,92,54,136,165,30,41
105,148,134,109,164,76,156,59,111,67
162,63,50,142,117,138,25,167,7,154,57
60,124,4,157,11,81,150,168,144,123,147,119
159,53,129,8,75,71,91,31,70,80,166,133,120
48,118,37,47,140,36,116,130,0,108,107,152,127,69
125,103,151,131,28,10,13,137,163,115,19,112,14,95,132
6,97,158,33,17,42,93,85,106,121,18,83,21,74
16,38,84,61,114,2,64,66,52,96,51,98,79
87,139,78,102,26,40,90,128,1,82,5,104
160,72,122,12,55,46,58,39,23,35,73
3,49,27,34,88,43,9,45,86,22
56,99,135,44,89,153,101,29,32
20,15,94,100,68,126,143,161`;
      case 9: return `209,156,142,110,202,210,128,123,148
183,193,23,89,125,61,182,74,122,171
158,8,152,215,66,107,208,19,150,207,153
168,103,16,70,30,3,73,190,203,216,108,104
51,159,100,172,55,80,145,105,129,111,120,177,198
41,58,119,114,76,175,200,130,206,124,10,127,86,137
88,154,213,64,194,143,149,180,163,106,167,195,21,136,134
29,176,67,90,54,155,81,68,0,179,117,83,98,26,35,39
95,185,24,116,17,131,191,96,85,92,115,32,40,44,71,212,101
169,214,25,147,196,4,178,15,65,45,84,60,174,59,166,141
91,201,146,161,97,197,133,184,102,157,57,72,9,12,22
42,126,48,1,94,189,13,132,14,188,162,165,11,20
205,144,43,204,27,173,151,31,7,37,69,187,93
170,56,138,181,77,36,109,18,199,139,140,87
113,99,186,52,5,121,6,47,33,78,118
63,28,46,38,49,160,164,192,211,112
135,34,82,62,79,50,2,75,53`;
      case 27: return `267,149,1433,1857,1425,1011,1794,971,1018,1030,558,1866,280,1956,1645,174,968,1489,155,9,285,383,1502,599,1154,714,1392
1554,1042,1845,248,1915,853,1974,1951,1864,1435,1741,1334,1581,400,966,1693,1734,452,1082,1953,227,1603,615,1799,948,1200,1402,86
1985,329,586,1354,1072,1989,1306,1588,347,1938,1790,1579,868,590,1513,1756,775,845,542,1812,1396,172,491,1672,84,973,1214,711,1633
403,857,1210,1555,1420,573,976,124,1936,2025,2084,1132,613,1761,1429,207,1324,1474,727,1618,1921,1282,2018,814,1999,167,1149,695,1152,430
676,1987,1349,866,1394,1511,1156,829,820,125,2014,540,882,317,1345,1986,1494,514,1464,917,1172,213,2094,2046,488,1320,1217,1083,497,1240,1090
458,1129,1559,83,1759,826,664,1229,28,112,1612,1175,2099,1641,943,1017,1887,1284,2049,1873,1186,1824,1346,233,1968,1592,1454,897,1482,1958,1373,1381
687,14,1587,941,828,1486,834,1647,506,1243,1153,1526,115,1753,486,1516,904,2035,123,1643,1830,974,1613,1878,749,1642,1917,730,1477,1299,1842,1518,1100
1536,1123,1430,1577,1395,1459,510,764,1236,1002,934,1560,96,813,358,1463,759,1519,1740,673,209,170,1586,1847,1876,427,1541,1862,579,1828,991,1195,1546,163
357,1891,712,54,464,1995,1052,1498,1545,916,1729,1466,690,1714,768,1890,1231,2059,1077,1605,1032,875,1086,309,887,1343,1637,476,838,1766,1558,35,2073,57,321
355,388,2069,620,1979,1080,1369,2089,1277,720,738,1085,2079,2067,1940,821,1254,1033,874,1700,463,1058,356,578,1304,102,1685,232,1762,2105,1361,1089,655,2037,49,2083
641,431,1549,1127,1224,515,986,99,626,1523,1028,2074,1462,399,2045,230,1760,195,805,1631,2040,819,1552,1732,1510,526,1203,1889,1922,1667,1319,1110,1342,1447,1572,1704,1628
1627,1805,1493,64,798,1903,2081,627,1168,1233,1417,1191,1124,133,1006,460,2061,166,93,1314,946,2041,619,1364,584,1885,1803,1521,1809,2038,72,1095,23,219,1724,345,178,1031
1636,191,754,587,663,1537,1835,1293,716,933,455,521,1348,1068,737,1047,288,284,1035,1119,1691,113,777,1280,1658,1441,1436,59,1415,1039,305,1432,2104,1817,425,709,1746,1971,648
568,1868,373,1998,1325,549,239,903,2034,745,122,17,275,920,956,1421,1097,1610,101,1912,1001,259,1880,1207,1087,2015,1792,1344,1505,1564,767,509,1607,1016,240,1528,1562,292,970,454
604,675,1404,1300,656,423,341,359,1386,429,839,2068,103,1893,2062,235,1945,519,1649,733,495,1534,2000,55,1286,104,2012,1452,1652,58,1881,256,625,66,884,1074,211,597,1706,1538,306
1065,1199,657,1407,1327,2088,173,552,1902,611,1703,1840,1531,1113,1813,1676,462,1491,416,1004,935,1611,969,2030,996,787,395,643,1258,295,779,2032,817,1265,561,843,1076,1791,1288,1907,1933,393
262,1894,437,1750,215,1223,717,644,165,883,822,185,1500,1506,1311,279,760,1620,685,689,700,1468,47,1585,1908,1993,77,647,799,913,1877,88,65,263,1211,1949,53,1307,37,1670,1169,1626,1535
595,504,1440,546,1278,876,729,1335,1777,457,622,192,860,1338,194,250,265,1188,389,634,699,243,659,1530,2019,1829,1318,791,1336,512,1239,1305,2023,1387,1428,1359,1865,44,1059,1408,1301,1514,892,69
975,1161,252,1134,1205,1755,126,1389,1069,231,524,1969,46,1976,1742,1819,1159,236,1105,418,930,1269,1340,1384,234,1370,911,1140,10,1731,1874,1173,964,789,1117,2098,691,1695,790,1765,1347,494,1023,1298,1401
1529,557,226,2057,1855,1754,1886,600,199,206,34,298,2065,286,922,1563,1547,1725,2060,681,1763,1723,410,442,1276,743,2087,1629,1680,481,919,803,2003,304,1379,325,1977,111,1251,1702,954,1580,1049,385,947,1565
902,1323,1602,618,1375,1711,1138,628,120,1743,881,824,1312,1996,1238,735,1646,1,1697,1681,1165,1192,1686,1752,156,1944,1730,1726,436,825,1595,650,1008,621,1570,658,2103,1232,229,906,686,1615,553,1838,1141,109,1215
327,1056,523,859,1640,770,1900,1814,755,438,1694,1721,323,2093,1827,539,1026,1219,885,222,1445,413,990,74,277,380,809,1380,1941,1321,406,1193,2101,1481,1209,1722,731,1872,214,1449,1997,1778,417,246,1617,1520,895,2047
1022,1126,1362,352,193,51,762,422,1575,926,129,2001,1496,1490,763,1844,804,2102,76,511,2078,1687,241,679,1442,175,2010,1249,1093,1720,2071,181,528,3,1984,247,909,1785,800,1166,1412,1015,1764,1624,548,2053,972,1619,180
945,1660,1804,698,349,639,1786,316,847,556,92,1261,740,766,827,999,1943,783,635,1066,1515,1403,1898,89,1715,1024,424,75,591,1478,1155,319,29,2052,713,958,924,291,26,1503,758,1029,1831,694,1268,1253,1241,210,1184,1302
840,448,801,402,1332,82,665,1614,1309,1716,2054,794,1852,2092,963,1839,1769,467,1289,157,1689,601,692,1994,312,1245,1137,354,335,1950,1390,1981,818,1088,1952,984,1128,1051,1115,1684,1788,564,1717,1145,208,823,1947,1012,1063,1036,91
281,140,1543,190,143,1043,2106,502,652,992,1548,1475,693,1053,1609,2024,1107,1422,1264,1177,870,245,443,1737,585,1727,197,899,1131,994,508,2080,1606,1962,1975,33,1696,21,1456,1883,1504,571,1427,776,1062,1797,748,366,1576,739,923,151
661,1157,1668,864,328,851,908,890,1738,1472,261,1899,369,1598,816,85,1888,606,1924,570,81,1638,566,1632,929,608,1061,38,1551,631,1244,2013,1674,594,1248,164,320,1905,1151,1054,856,1683,1973,1146,852,1084,1235,118,184,297,1291,806,1118
1465,1901,900,20,31,1550,1122,333,872,0,1019,672,1960,638,1821,1810,637,276,447,1783,1183,187,513,435,453,5,707,2027,1665,114,1322,1811,22,1424,1378,1793,1919,1275,2086,1075,131,1964,997,1439,642,893,1310,797,1501,646,1252,1897
773,216,1182,1226,837,1654,1875,1158,1060,218,1650,1181,1133,1197,721,15,1699,569,1196,772,244,593,428,1492,2063,1970,440,2058,1736,1690,73,1260,382,478,1825,258,1739,1946,177,957,1591,1768,1517,136,1733,914,563,1467,1522,360,2026
1397,1701,734,282,1635,886,339,898,2005,264,575,414,1009,878,1398,342,662,1860,1589,1287,1991,1818,473,660,1255,680,889,1507,1957,499,1295,1596,654,128,30,1856,2008,2070,278,1718,1590,371,449,2077,145,426,1366,841,1480,350
153,1070,907,577,201,411,850,1929,645,1041,1782,1458,1281,810,296,1978,1385,736,1216,108,551,310,1692,1227,993,1330,1800,1533,550,1356,307,489,249,1858,1292,2004,697,983,1242,1712,1352,322,1557,981,574,1622,441,484,415
79,649,1262,315,961,12,1057,1230,200,1772,862,705,1807,871,792,588,344,1221,340,1451,302,1959,614,1571,1116,1834,142,1483,701,1114,159,182,372,1333,42,2096,1365,32,544,13,409,752,465,1208,1931,469,1187,1832
1980,242,607,1748,294,1198,978,555,1542,1789,1524,938,1055,303,338,401,1247,1367,666,1109,1806,1923,1895,470,1228,498,1781,1954,1749,1870,405,541,918,1634,1914,888,1081,1497,1050,1315,2036,782,950,1273,365,1882,2033
1326,152,203,1604,1171,684,334,1413,951,117,1317,18,1525,2021,1431,1406,2043,56,912,346,1316,1593,445,937,439,80,1218,520,1666,1623,1569,1573,753,1965,2009,1798,2042,68,97,1040,378,722,877,583,1174,2051
1630,1776,928,725,1948,348,848,532,865,2048,1274,1988,1815,667,407,391,953,269,41,1822,1913,1446,493,530,332,2076,384,1826,1843,1601,107,1098,450,518,1453,1393,980,761,1484,967,2075,289,788,1499,492
1416,1904,386,1774,781,795,2095,2,432,1846,501,582,747,2100,376,1371,1849,678,318,1871,671,189,1025,1189,1037,217,1802,836,1176,196,1104,1360,728,1078,2006,1256,1092,955,750,959,1937,1106,471,545
1279,1744,377,1918,1185,1561,228,1926,202,718,995,1582,1910,1682,224,1021,220,1163,849,536,559,525,420,2017,1448,863,25,1544,1013,379,1409,479,1495,444,757,503,1374,623,858,1773,1353,1566,603
1568,434,1578,1916,560,419,894,362,1328,1837,1351,921,1476,397,361,1237,1707,1437,669,905,831,944,283,1770,313,19,1372,1584,1423,832,1438,2022,1708,1285,1527,1713,1125,134,765,842,1892,1263
844,198,1599,1400,326,2090,1850,1705,1339,61,398,176,1419,1250,1710,1357,1272,596,1673,505,1091,1220,290,404,314,1597,1102,910,2029,1836,609,1594,446,1434,1553,1020,146,786,363,127,466
1796,119,1927,331,1204,565,1411,580,589,1728,1485,869,343,330,1678,1608,1932,715,554,299,2020,60,688,538,982,516,1038,2064,1972,1863,2011,2007,979,835,7,1663,960,1294,710,2066
268,1930,1139,1854,1358,1443,1222,238,1368,1709,1992,1142,612,71,1967,336,324,778,36,581,527,1162,204,1841,2028,942,8,490,677,459,636,1414,977,987,830,254,896,1179,1213
807,94,408,1246,1003,811,1303,572,421,482,985,162,2091,1206,1935,1911,724,171,769,301,287,1096,1410,517,1341,1909,132,1920,1048,260,1869,147,472,485,1120,1966,793,223
337,78,1212,1540,1130,1225,2050,1771,300,547,270,1271,1257,1103,1556,1178,1111,674,1461,616,381,931,1848,537,1046,98,1853,272,387,311,1007,370,1600,433,1296,605,952
507,867,1457,1331,703,1621,998,412,179,1487,186,771,1758,67,1625,1820,774,682,375,1934,1297,1675,451,487,148,11,1148,1450,925,1616,1735,456,1005,62,169,1644
2082,1698,723,87,2055,702,480,732,1574,1808,135,1418,1180,939,160,873,1170,364,2044,1388,468,1045,1757,1376,891,475,496,1823,100,879,1136,1101,1661,780,1329
1270,1190,1405,1164,653,1099,139,927,846,1469,90,1539,1266,1267,1780,670,1201,1071,253,1955,293,624,1656,212,1337,1512,746,1014,271,1787,1377,602,52,1651
63,1064,477,632,1391,567,1664,949,1034,1135,183,708,1383,1079,1784,1655,1509,2072,1160,1779,1679,95,1194,751,1906,121,726,1532,1108,24,368,1112,1639
1094,116,2097,2002,988,1167,1308,1073,367,880,531,640,562,1234,1801,629,273,1010,1470,855,168,785,110,965,598,130,257,696,1488,1144,962,1567
854,40,1067,1508,158,1982,137,529,784,1767,225,1283,1657,1027,1143,1202,1355,533,27,461,1583,719,535,1044,221,1990,1861,756,374,543,534
741,1363,1925,704,808,396,1653,940,1747,1290,802,633,630,161,1851,2016,1000,1859,1259,1455,706,2039,474,1444,932,266,1669,483,522,39
1121,138,1350,617,592,742,237,1671,901,392,150,683,861,1473,1816,255,141,651,144,796,394,989,390,16,1688,1479,1150,1879,105
351,1460,308,188,45,668,1939,353,1928,610,43,812,1775,576,1983,70,106,1382,2085,1961,4,1313,1659,1963,1719,2056,1942,1662
833,936,6,48,1426,1751,1745,1147,154,500,251,205,1399,2031,50,1884,1867,1833,1896,1471,274,1677,744,1648,915,1795,815`;
   }
}

//// END ////
main()
