import { Strategy } from "./strategy";
import { Context, SnakeDirection, Position } from "./context";

const gridSize = 18;

export class CustomStrategy implements Strategy {
  graph = getGraph();
  /**
   * General strategy: Just find the shortest path from the current position to the fruit.
   * In the first 500 moves, it is rather unlikely that this will yield
   * in a situation where all paths are blocked by the snake.
   */
  step(context: Context): SnakeDirection {
    // This executes the a* algorithm to find the optimal path to the next fruit.
    const pathToFood = this.graph.findPath({
      startNode: context,
      isEnd: (s) =>
        hashPosition(s.snake.parts[0]) === hashPosition(context.fruit),
      estimateCost: (s) => {
        const currentHead = s.snake.parts[0];
        const xDist = Math.abs(currentHead.x - context.fruit.x);
        const xDistReverse = gridSize - xDist;

        const yDist = Math.abs(currentHead.y - context.fruit.y);
        const yDistReverse = gridSize - yDist;
        return Math.min(xDist, xDistReverse) + Math.min(yDist, yDistReverse);
      },
      // If this path is longer than 50 moves, fail the search, to prevent
      // browser freezes.
      maxCosts: 50,
    });

    if (pathToFood.isFail()) {
      console.log("Error - no path found!");
      return SnakeDirection.left;
    } else {
      const firstStep = pathToFood.getPath()[1].data;
      const currentHead = context.snake.parts[0];
      const nextHead = firstStep.snake.parts[0];
      if (nextHead.x === currentHead.x + 1) {
        return SnakeDirection.right;
      }
      if (nextHead.x === currentHead.x + 1 - gridSize) {
        return SnakeDirection.right;
      }

      if (nextHead.x === currentHead.x - 1) {
        return SnakeDirection.left;
      }
      if (nextHead.x === currentHead.x - 1 + gridSize) {
        return SnakeDirection.left;
      }

      if (nextHead.y === currentHead.y + 1) {
        return SnakeDirection.down;
      }
      if (nextHead.y === currentHead.y + 1 - gridSize) {
        return SnakeDirection.down;
      }

      if (nextHead.y === currentHead.y - 1) {
        return SnakeDirection.up;
      }
      if (nextHead.y === currentHead.y - 1 + gridSize) {
        return SnakeDirection.up;
      }

      return SnakeDirection.left;
    }
  }
}

const getGraph = () =>
  new LazyGraph<Context>({
    // Get possible next head positions for current state
    // No matter if the position is viable for finding the target
    getNeighbours: (context) => {
      const snakeParts = context.snake.parts;
      const { x: headX, y: headY } = snakeParts[0];

      const candidates = [
        { x: headX + 1, y: headY },
        { x: headX, y: headY + 1 },
        { x: headX - 1, y: headY },
        { x: headX, y: headY - 1 },
      ];

      for (const c of candidates) {
        if (c.x < 0) c.x = gridSize - 1;
        if (c.y < 0) c.y = gridSize - 1;
        if (c.y === gridSize) c.y = 0;
        if (c.x === gridSize) c.x = 0;
      }

      const newSnakeTail = snakeParts.slice(0, -1);

      const obstacleHashes = context.obstacles.map(hashPosition);
      const snakeTailHashes = snakeParts.map(hashPosition);

      const validCandidates = candidates.filter((c) => {
        const hash = hashPosition(c);
        return (
          !obstacleHashes.includes(hash) && !snakeTailHashes.includes(hash)
        );
      });

      const newStates = validCandidates.map(
        (c): Context => {
          return {
            ...context,
            snake: {
              ...context.snake,
              parts: [c, ...newSnakeTail],
            },
          };
        }
      );

      return newStates;
    },
    // Only account for the first 6 parts of the snake for
    // comparing different states
    hashData: (context) =>
      context.snake.parts.slice(0, 5).map(hashPosition).join(" --- "),
  });

function hashPosition(p: Position) {
  return `${p.x}-${p.y}`;
}

/**

.##.......####.########...######........###....##.....##.########....###....########.
.##........##..##.....##.##....##......##.##...##.....##.##.........##.##...##.....##
.##........##..##.....##.##...........##...##..##.....##.##........##...##..##.....##
.##........##..########...######.....##.....##.#########.######...##.....##.##.....##
.##........##..##.....##.......##....#########.##.....##.##.......#########.##.....##
.##........##..##.....##.##....##....##.....##.##.....##.##.......##.....##.##.....##
.########.####.########...######.....##.....##.##.....##.########.##.....##.########.

 */

export interface LazyGraphConfig<DataType> {
  /**
   * Calculates cost between 2 neighbouring nodes.
   * Defaults to () => 1
   */
  getNeighbourCost?: (data1: DataType, data2: DataType) => number;

  /**
   * Returns neighbours of a given node.
   */
  getNeighbours: (data: DataType) => DataType[];

  /**
   * Returns a string representation of the node.
   * Defaults to JSON.stringify
   */
  hashData?: (data: DataType) => string;
}

class LazyGraph<DataType> {
  private config: NonNullable<LazyGraphConfig<DataType>>;
  constructor(config: LazyGraphConfig<DataType>) {
    this.config = {
      hashData: (data) => JSON.stringify(data),
      getNeighbourCost: () => 1,
      ...config,
    };
  }

  findPath(
    config: Omit<AStarConfig<DataType>, keyof LazyGraphConfig<DataType>>
  ) {
    return aStar({ ...config, ...this.config });
  }
}

interface AStarConfig<DataType> {
  /**
   * Used to estimate remaining cost of a node. MUST NOT overestimate the cost.
   * Defaults to () => 0
   */
  estimateCost?: (data: DataType) => number;

  /**
   * Calculates cost between 2 neighbour nodes.
   * Defaults to () => 1
   */
  getNeighbourCost?: (data1: DataType, data2: DataType) => number;

  /**
   * Returns neighbours of a given node.
   */
  getNeighbours: (data: DataType) => DataType[];

  /**
   * Returns a string representation of the node.
   * Defaults to toString()
   */
  hashData?: (data: DataType) => string;

  /**
   * Order in which the nodes get expanded. Return negative number if a should come before b.
   * Defaults to a.f - b.f
   */
  heapComperator?: (
    node1: AStarNode<DataType>,
    node2: AStarNode<DataType>
  ) => number;

  /**
   * Determines if node is the goal.
   */
  isEnd: (data: DataType) => boolean;

  /**
   * When maxCosts is given, the algorithm stops when maxCosts is reached
   * Defaults to Infinity
   */
  maxCosts?: number;

  // First node in the open list
  startNode: DataType;
}

interface AStarNode<DataType> {
  data: DataType;

  // Current costs to reach this node
  g: number;

  // Estimated remaining costs for this node.
  h: number;

  // Sum of g and h. This is the cost value that is used to determine next nodes.
  f: number;

  // Identifier for this data node. Used to prevent duplicates.
  hash: string;

  previousNode?: AStarNode<DataType>;
}

function aStar<DataType>(config: AStarConfig<DataType>) {
  const {
    estimateCost = () => 0,
    getNeighbourCost = () => 1,
    getNeighbours,
    hashData = (x: { toString: () => string }) => x.toString(),
    heapComperator = (a: AStarNode<DataType>, b: AStarNode<DataType>) =>
      a.f - b.f,
    isEnd,
    maxCosts = Infinity,
    startNode: startData,
  } = config;

  const shouldNodeComeBeforeNode = (
    a: AStarNode<DataType>,
    b: AStarNode<DataType>
  ) => heapComperator(a, b) < 0;

  const startNode = {
    data: startData,
    g: 0,
    h: estimateCost(startData),
    f: estimateCost(startData),
    hash: hashData(startData),
  };
  const openNodesByHash = new Map<string, AStarNode<DataType>>();
  const openNodes = new Heap(shouldNodeComeBeforeNode);
  const closedNodesByHash = new Map<string, AStarNode<DataType>>();

  openNodesByHash.set(startNode.hash, startNode);
  openNodes.add(startNode);

  let counter = 0;
  while (openNodes.size !== 0) {
    const node = openNodes.pop() as AStarNode<DataType>;
    if (!openNodesByHash.has(node.hash)) continue;
    openNodesByHash.delete(node.hash);

    closedNodesByHash.set(node.hash, node);
    if (isEnd(node.data)) return finish(node, counter, closedNodesByHash);
    if (node.g > maxCosts) return finish(node, counter, closedNodesByHash);
    counter++;

    const neighbourData = getNeighbours(node.data);
    for (let i = 0; i < neighbourData.length; i++) {
      const currentData = neighbourData[i];
      const hash = hashData(currentData);
      if (closedNodesByHash.has(hash)) continue;
      const g = node.g + getNeighbourCost(node.data, currentData);

      const existingNode = openNodesByHash.get(hash);
      if (existingNode !== undefined && g >= existingNode.g) continue;

      const h = estimateCost(currentData);
      const neighbourNode = {
        data: currentData,
        f: g + h,
        h,
        g,
        hash,
        previousNode: node,
      };
      openNodesByHash.set(hash, neighbourNode);
      openNodes.add(neighbourNode);
    }
  }
  return fail(closedNodesByHash, counter);
}

interface AStarResult<T> {
  status: string;
  expandedNodeCounter: number;
  getExpandedNodes: () => IterableIterator<AStarNode<T>>;
  isFail: (this: AStarResult<T>) => this is AStarFailResult<T>;
  isSuccess: (this: AStarResult<T>) => this is AStarSuccessResult<T>;
}

interface AStarFailResult<T> extends AStarResult<T> {
  status: "Fail :(";
}

interface AStarSuccessResult<T> extends AStarResult<T> {
  cost: number;
  target: AStarNode<T>;
  getPath: () => AStarNode<T>[];
}

function fail<T>(
  closedNodesByHash: Map<string, AStarNode<T>>,
  counter: number
): AStarFailResult<T> {
  return {
    expandedNodeCounter: counter,
    getExpandedNodes: () => closedNodesByHash.values(),
    isFail: () => true,
    isSuccess: () => false,
    status: "Fail :(",
  };
}

function finish<T>(
  node: AStarNode<T>,
  counter: number,
  closedNodesByHash: Map<string, AStarNode<T>>
): AStarSuccessResult<T> {
  const path = recursiveNodeToArray(node);
  return {
    cost: node.g,
    expandedNodeCounter: counter,
    getExpandedNodes: () => closedNodesByHash.values(),
    getPath: () => path,
    isFail: () => false,
    isSuccess: () => true,
    status: "success",
    target: path[path.length - 1],
  };
}

function recursiveNodeToArray<T>(node: AStarNode<T>) {
  const result: Omit<AStarNode<T>, "previousNode">[] = [];
  let current = node;
  while (current) {
    result.unshift(omit(current, "previousNode") as AStarNode<T>);
    current = current.previousNode as AStarNode<T>;
  }
  return result;
}

interface OmitFunction {
  <T extends object, K extends [...(keyof T)[]]>(obj: T, ...keys: K): {
    [K2 in Exclude<keyof T, K[number]>]: T[K2];
  };
}

const omit: OmitFunction = (obj, ...keys) => {
  let ret = {} as {
    [K in keyof typeof obj]: typeof obj[K];
  };
  let key: keyof typeof obj;
  for (key in obj) {
    if (!keys.includes(key)) {
      ret[key] = obj[key];
    }
  }
  return ret;
};

interface ShouldBeBefore<T> {
  (a: T, b: T): boolean;
}

class Heap<T> {
  private items: T[] = [];

  public get size(): number {
    return this.items.length - 1;
  }

  constructor(private shouldBeBefore: ShouldBeBefore<T>) {
    this.items.length = 1;
  }

  private getParentIndexOf(index: number) {
    if (index === 1) return index;
    return Math.floor(index / 2);
  }

  private getLeftChildIndexOf(index: number) {
    return 2 * index;
  }

  private getRightChildIndexOf(index: number) {
    return 2 * index + 1;
  }

  private siftUp(startIndex: number) {
    if (startIndex === 1) return;
    const item = this.items[startIndex];
    const parentIndex = this.getParentIndexOf(startIndex);
    const parentItem = this.items[parentIndex];
    const shouldBeBefore = this.shouldBeBefore(item, parentItem);
    if (!shouldBeBefore) return;
    this.items[parentIndex] = item;
    this.items[startIndex] = parentItem;
    this.siftUp(parentIndex);
  }

  private siftDown(startIndex: number) {
    const item = this.items[startIndex];
    const leftChildIndex = this.getLeftChildIndexOf(startIndex);
    const rightChildIndex = this.getRightChildIndexOf(startIndex);
    const leftChild = this.items[leftChildIndex];
    const rightChild = this.items[rightChildIndex];
    const isLeaf = !leftChild && !rightChild;
    if (isLeaf) return;
    const leftIsSwapCandidate = rightChild
      ? this.shouldBeBefore(leftChild, rightChild)
      : true;
    const swapIndex = leftIsSwapCandidate ? leftChildIndex : rightChildIndex;
    const swapChild = this.items[swapIndex];
    if (this.shouldBeBefore(item, swapChild)) return;
    this.items[swapIndex] = item;
    this.items[startIndex] = swapChild;
    this.siftDown(swapIndex);
  }

  public add(item: T) {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  public peek(): T {
    return this.items[1];
  }

  public pop(): T | undefined {
    if (this.size === 0) return undefined;
    const item = this.items[1];
    const lastItem = this.items[this.size];
    this.items[1] = lastItem;
    this.items.pop();
    this.siftDown(1);
    return item;
  }

  public popAll(): T[] {
    const result: T[] = [];
    while (this.size !== 0) result.push(this.pop() as T);
    return result;
  }
}
