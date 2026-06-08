const PluginBase = loadPluginBase()

function loadPluginBase() {
  try {
    return require('obsidian').Plugin
  } catch {
    return class Plugin {}
  }
}

function transformRenderedDefinitionLists(root) {
  if (!root || !root.ownerDocument) {
    return
  }

  transformElement(root)
}

function transformElement(element) {
  if (!element || element.tagName === 'DL') {
    return
  }

  transformDirectChildren(element)

  for (const child of Array.from(element.children)) {
    transformElement(child)
  }
}

function transformDirectChildren(container) {
  const children = Array.from(container.children)

  for (let index = 0; index < children.length; ) {
    const definitionListChildren = []
    let consumed = 0

    while (true) {
      const pair = parseDefinitionPair(children, index + consumed)

      if (!pair) {
        break
      }

      definitionListChildren.push(...pair.children)
      consumed += pair.consumed
    }

    if (definitionListChildren.length === 0) {
      index += 1
      continue
    }

    const firstChild = children[index]
    const definitionList = container.ownerDocument.createElement('dl')
    definitionList.className = 'ob-dl-definition-list'

    for (const child of definitionListChildren) {
      definitionList.appendChild(child)
    }

    firstChild.before(definitionList)

    for (let cursor = 0; cursor < consumed; cursor += 1) {
      children[index + cursor]?.remove()
    }

    index += consumed
  }
}

function parseDefinitionPair(children, index) {
  const block = getParagraphBlock(children[index])

  if (!block) {
    return null
  }

  const lines = splitParagraphIntoLines(block.paragraph)

  if (isSingleParagraphDefinitionList(lines)) {
    return {
      children: createDefinitionPair(
        block.paragraph.ownerDocument,
        trimLine(lines[0]),
        lines.slice(1).map((line) => stripLinePrefix(trimLine(line))),
      ),
      consumed: 1,
    }
  }

  if (startsWithDefinitionMarker(lines[0])) {
    return null
  }

  const definitionLines = []
  let consumed = 1

  for (let cursor = index + 1; cursor < children.length; cursor += 1) {
    const siblingBlock = getParagraphBlock(children[cursor])

    if (!siblingBlock) {
      break
    }

    const siblingLines = splitParagraphIntoLines(siblingBlock.paragraph)

    if (!siblingLines.every(startsWithDefinitionMarker)) {
      break
    }

    definitionLines.push(
      ...siblingLines.map((line) => stripLinePrefix(trimLine(line))),
    )
    consumed += 1
  }

  if (definitionLines.length === 0) {
    return null
  }

  return {
    children: createDefinitionPair(
      block.paragraph.ownerDocument,
      trimLine(
        Array.from(block.paragraph.childNodes).map((child) => child.cloneNode(true)),
      ),
      definitionLines,
    ),
    consumed,
  }
}

function getParagraphBlock(node) {
  if (isParagraph(node)) {
    return {
      paragraph: node,
    }
  }

  if (!node || node.children.length !== 1) {
    return null
  }

  const [child] = Array.from(node.children)

  if (!isParagraph(child)) {
    return null
  }

  return {
    paragraph: child,
  }
}

function createDefinitionPair(document, termChildren, definitionLines) {
  const definitionTerm = document.createElement('dt')
  const definitionDescription = document.createElement('dd')

  for (const child of pruneEmptyTextNodes(termChildren)) {
    definitionTerm.appendChild(child)
  }

  for (const block of createDefinitionBlocks(document, definitionLines)) {
    definitionDescription.appendChild(block)
  }

  return [definitionTerm, definitionDescription]
}

function createDefinitionBlocks(document, definitionLines) {
  const blocks = []

  for (let index = 0; index < definitionLines.length; ) {
    const line = definitionLines[index]
    const orderedItem = stripListMarker(line, /^(\d+)\.\s+/)

    if (orderedItem) {
      const list = document.createElement('ol')
      list.start = orderedItem.start
      list.appendChild(createListItemNode(document, orderedItem.children))
      index += 1

      while (index < definitionLines.length) {
        const nextOrderedItem = stripListMarker(
          definitionLines[index],
          /^(\d+)\.\s+/,
        )

        if (!nextOrderedItem) {
          break
        }

        list.appendChild(createListItemNode(document, nextOrderedItem.children))
        index += 1
      }

      blocks.push(list)
      continue
    }

    const unorderedItem = stripListMarker(line, /^[-*+]\s+/)

    if (unorderedItem) {
      const list = document.createElement('ul')
      list.appendChild(createListItemNode(document, unorderedItem.children))
      index += 1

      while (index < definitionLines.length) {
        const nextUnorderedItem = stripListMarker(
          definitionLines[index],
          /^[-*+]\s+/,
        )

        if (!nextUnorderedItem) {
          break
        }

        list.appendChild(createListItemNode(document, nextUnorderedItem.children))
        index += 1
      }

      blocks.push(list)
      continue
    }

    const paragraph = document.createElement('p')

    for (const child of pruneEmptyTextNodes(line)) {
      paragraph.appendChild(child)
    }

    blocks.push(paragraph)
    index += 1
  }

  return blocks
}

function createListItemNode(document, children) {
  const listItem = document.createElement('li')

  for (const child of pruneEmptyTextNodes(children)) {
    listItem.appendChild(child)
  }

  return listItem
}

function isSingleParagraphDefinitionList(lines) {
  return (
    lines.length >= 2 &&
    !startsWithDefinitionMarker(lines[0]) &&
    lines.slice(1).every(startsWithDefinitionMarker)
  )
}

function startsWithDefinitionMarker(line) {
  return serializeNodes(line).startsWith(':')
}

function splitParagraphIntoLines(paragraph) {
  const lines = [[]]

  for (const child of Array.from(paragraph.childNodes)) {
    if (child.nodeType === child.TEXT_NODE) {
      const parts = child.textContent.split(/\r?\n/)

      for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index]

        if (part.length > 0) {
          lines.at(-1).push(paragraph.ownerDocument.createTextNode(part))
        }

        if (index < parts.length - 1) {
          lines.push([])
        }
      }

      continue
    }

    if (child.nodeName === 'BR') {
      lines.push([])
      continue
    }

    lines.at(-1).push(child.cloneNode(true))
  }

  return lines
}

function trimLine(line) {
  const trimmed = cloneNodes(line)

  for (let index = 0; index < trimmed.length; index += 1) {
    const node = trimmed[index]

    if (node?.nodeType === node.TEXT_NODE) {
      node.textContent = node.textContent.replace(/^\s+/, '')

      if (node.textContent.length === 0) {
        trimmed.splice(index, 1)
        index -= 1
        continue
      }

      break
    }

    break
  }

  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    const node = trimmed[index]

    if (node?.nodeType === node.TEXT_NODE) {
      node.textContent = node.textContent.replace(/\s+$/, '')

      if (node.textContent.length === 0) {
        trimmed.splice(index, 1)
        continue
      }

      break
    }

    break
  }

  return trimmed
}

function stripLinePrefix(line) {
  return replaceLeadingText(line, /^:\s*/, '')
}

function stripListMarker(line, pattern) {
  const source = serializeNodes(line)
  const match = source.match(pattern)

  if (!match) {
    return null
  }

  return {
    start: match[1] ? Number(match[1]) : 1,
    children: replaceLeadingText(line, pattern, ''),
  }
}

function replaceLeadingText(line, pattern, replacement) {
  const nextLine = cloneNodes(line)
  const firstTextNode = findFirstTextNode(nextLine)

  if (firstTextNode?.textContent) {
    firstTextNode.textContent = firstTextNode.textContent.replace(
      pattern,
      replacement,
    )
  }

  return nextLine
}

function findFirstTextNode(nodes) {
  for (const node of nodes) {
    const textNode = findFirstTextNodeInNode(node)

    if (textNode) {
      return textNode
    }
  }

  return null
}

function findFirstTextNodeInNode(node) {
  if (node.nodeType === node.TEXT_NODE) {
    return node
  }

  for (const child of Array.from(node.childNodes ?? [])) {
    const textNode = findFirstTextNodeInNode(child)

    if (textNode) {
      return textNode
    }
  }

  return null
}

function pruneEmptyTextNodes(line) {
  return line.filter(
    (node) => node.nodeType !== node.TEXT_NODE || node.textContent !== '',
  )
}

function cloneNodes(line) {
  return line.map((node) => node.cloneNode(true))
}

function serializeNodes(nodes) {
  return nodes.map((node) => node.textContent ?? '').join('')
}

function isParagraph(node) {
  return node?.tagName === 'P'
}

class DefinitionListPlugin extends PluginBase {
  onload() {
    this.registerMarkdownPostProcessor((element) => {
      transformRenderedDefinitionLists(element)
    })
  }
}

module.exports = DefinitionListPlugin
module.exports.DefinitionListPlugin = DefinitionListPlugin
module.exports.transformRenderedDefinitionLists = transformRenderedDefinitionLists
