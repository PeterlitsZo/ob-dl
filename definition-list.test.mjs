import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

import mainModule from './main.js'

const { transformRenderedDefinitionLists } = mainModule

function render(html) {
  const dom = new JSDOM(`<div id="root">${html}</div>`)
  const root = dom.window.document.querySelector('#root')

  transformRenderedDefinitionLists(root)

  return root
}

describe('transformRenderedDefinitionLists', () => {
  it('supports Obsidian-style wrapped paragraph blocks', () => {
    const root = render(
      [
        '<div class="el-p"><p>TCP</p></div>',
        '<div class="el-p"><p>: 面向连接的传输协议</p></div>',
        '<div class="el-p"><p>UDP</p></div>',
        '<div class="el-p"><p>: 无连接的传输协议</p></div>',
      ].join(''),
    )

    const definitionList = root.querySelector('dl')

    expect(definitionList).toBeTruthy()
    expect(
      Array.from(definitionList.querySelectorAll('dt')).map((node) => node.textContent),
    ).toEqual(['TCP', 'UDP'])
    expect(
      Array.from(definitionList.querySelectorAll('dd')).map((node) => node.textContent),
    ).toEqual(['面向连接的传输协议', '无连接的传输协议'])
  })

  it('supports single-paragraph definition list syntax', () => {
    const root = render('<p>TCP\n: 面向连接的传输协议\n: 提供可靠传输</p>')

    const definitionList = root.querySelector('dl')

    expect(definitionList?.querySelector('dt')?.textContent).toBe('TCP')
    expect(
      Array.from(definitionList?.querySelectorAll('dd p') ?? []).map(
        (node) => node.textContent,
      ),
    ).toEqual(['面向连接的传输协议', '提供可靠传输'])
  })

  it('renders adjacent term-definition paragraphs as one definition list', () => {
    const root = render(
      [
        '<p>TCP</p>',
        '<p>: 面向连接的传输协议</p>',
        '<p>UDP</p>',
        '<p>: 无连接的传输协议</p>',
      ].join(''),
    )

    const definitionList = root.querySelector('dl')

    expect(definitionList).toBeTruthy()
    expect(
      Array.from(definitionList.querySelectorAll('dt')).map((node) => node.textContent),
    ).toEqual(['TCP', 'UDP'])
    expect(
      Array.from(definitionList.querySelectorAll('dd')).map((node) => node.textContent),
    ).toEqual(['面向连接的传输协议', '无连接的传输协议'])
  })

  it('merges multiple definition lines into paragraphs and lists', () => {
    const root = render(
      [
        '<p><code>block_on</code></p>',
        '<p>: 在当前线程上运行一个 future。</p>',
        '<p>: 这个方法会在以下情况下 panic：</p>',
        '<p>: 1. 提供的 future 本身 panic 了。</p>',
        '<p>: 2. 如果它在一个异步上下文中被调用。</p>',
      ].join(''),
    )

    const definitionList = root.querySelector('dl')
    const details = definitionList?.querySelector('dd')

    expect(definitionList?.querySelector('dt')?.textContent).toBe('block_on')
    expect(Array.from(details?.querySelectorAll('p') ?? []).map((node) => node.textContent)).toEqual([
      '在当前线程上运行一个 future。',
      '这个方法会在以下情况下 panic：',
    ])
    expect(
      Array.from(details?.querySelectorAll('ol li') ?? []).map((node) => node.textContent),
    ).toEqual(['提供的 future 本身 panic 了。', '如果它在一个异步上下文中被调用。'])
  })

  it('renders unordered list items inside one definition', () => {
    const root = render(
      [
        '<p>CLI</p>',
        '<p>: - 更快</p>',
        '<p>: - 更容易组合</p>',
      ].join(''),
    )

    expect(
      Array.from(root.querySelectorAll('dd ul li')).map((node) => node.textContent),
    ).toEqual(['更快', '更容易组合'])
  })
})
