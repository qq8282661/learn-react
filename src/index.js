function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === 'object' ? child : createTextElement(child),
      ),
    },
  };
}

function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

function createDom(fiber) {
  console.log(fiber);
  const dom =
    fiber.type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);
  return dom;
}

// 调和子代
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;
    //  compare oldFiber to element
    const sameType = oldFiber && element && element.type === oldFiber.type;
    if (sameType) {
      // update the node
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      };
    }
    if (element && !sameType) {
      // add this node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT',
      };
    }
    if (oldFiber && !sameType) {
      //  delete the oldFiber's node
      oldFiber.effectTag = 'DELETION';
      deletions.push(oldFiber);
    }
    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    // const newFiber = {
    //   type: element.type,
    //   props: element.props,
    //   parent: wipFiber,
    //   dom: null,
    // };

    // 如果是第一个孩子
    if (index === 0) {
      //向父fiber结构树中添加孩子节点
      wipFiber.child = newFiber;
    } else {
      // 向前一个兄弟节点添加兄弟节点属性
      prevSibling.sibling = newFiber;
    }
    // 前一个兄弟节点变成当前fiber结构
    prevSibling = newFiber;
    index++;
  }
}

// 是否是事件
const isEvent = (key) => key.startsWith('on');
// 是否是属性
const isProperty = (key) => key !== 'children' && !isEvent(key);
// 是否是新属性
const isNew = (prev, next) => (key) => prev[key] !== next[key];
// 是否消失
const isGone = (prev, next) => (key) => !(key in next);

function updateDom(dom, prevProps, nextProps) {
  //Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.substring(2).toLowerCase();
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // 设置已经删除的props为''
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = '';
    });

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name];
    });
  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.substring(2).toLowerCase();
      console.log('eventType', eventType);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

// 提交跟节点
function commitRoot() {
  deletions.forEach(commitRoot);
  // add node to dom
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

// 提交作业
function commitWork(fiber) {
  if (!fiber) return;
  const domParent = fiber.parent.dom;
  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === 'DELETION') {
    domParent.removeChild(fiber.dom);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}
// 渲染dom
function render(element, container) {
  // set nextUnitOfWork to the root of the fiber tree.
  console.log(element);
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };

  deletions = [];
  nextUnitOfWork = wipRoot;
}
let nextUnitOfWork = null;
let wipRoot = null;
let currentRoot = null;
let deletions = null;

// 工作循环
function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  if (!nextUnitOfWork && wipRoot) commitRoot();

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

// 执行单元任务
function performUnitOfWork(fiber) {
  // TODO add dom node
  // TODO create new fibers
  // TODO return next unit of work

  // 为传入的fiber创建dom元素
  if (!fiber.dom) fiber.dom = createDom(fiber);

  // 在这里不是已经向父元素的dom添加了子dom了么
  //每次处理元素时，我们都会向DOM添加一个新节点。而且，请记住，
  //在完成渲染整个树之前，浏览器可能会中断我们的工作。在这种情况下，用户将看到不完整的UI。而且我们不想要那样。
  //因此，我们需要从此处删除更改DOM的部分。
  // if (fiber.parent) fiber.parent.dom.appendChild(fiber.dom);

  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);

  // 向下深度遍历所有fiber节点的第一个子节点
  if (fiber.child) return fiber.child;
  let nextFiber = fiber;
  while (nextFiber) {
    // 同级遍历下一个兄弟fiber节点
    if (nextFiber.sibling) return nextFiber.sibling;
    nextFiber = nextFiber.parent;
  }
}

const OwnReact = {
  createElement,
  render,
};
/** 
const element = <h1 title="foo">Hello</h1>;

const element = React.createElement(
    "h1",
    { title: "foo" },
    "Hello"
  );
const element = {
  type: 'h1',
  props: {
    title: 'foo',
    children: 'Hello',
  },
};
const container = document.getElementById('root');
const node = document.createElement(element.type);
node['title'] = element.props.title;
const text = document.createTextNode('');
text['nodeValue'] = element.props.children;
node.appendChild(text);
container.appendChild(node);
*/

/** @jsx OwnReact.createElement */

// const element = <h1 title="foo">Hello</h1>;

const container = document.getElementById('root');

const updateValue = (e) => {
  rerender(e.target.value);
};

const rerender = (value) => {
  const element = (
    <div>
      <input onInput={updateValue} value={value} />
      <h2>Hello {value}</h2>
    </div>
  );
  // eslint-disable-next-line react/no-deprecated
  OwnReact.render(element, container);
};

rerender('World');
