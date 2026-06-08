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

function renderStandalone(tagName, innerHtml) {
  const dom = new JSDOM(
    `<div id="wrap"><${tagName} id="root">${innerHtml}</${tagName}></div>`,
  )
  const root = dom.window.document.querySelector('#root')

  transformRenderedDefinitionLists(root)

  return dom.window.document.querySelector('#wrap')
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

  it('supports a paragraph element as the post-processor root', () => {
    const wrapper = renderStandalone(
      'p',
      'TCP<br>: 面向连接的传输协议<br>: 提供可靠传输',
    )

    const definitionList = wrapper.querySelector('dl')

    expect(definitionList?.querySelector('dt')?.textContent).toBe('TCP')
    expect(
      Array.from(definitionList?.querySelectorAll('dd p') ?? []).map(
        (node) => node.textContent,
      ),
    ).toEqual(['面向连接的传输协议', '提供可靠传输'])
  })

  it('replaces a paragraph root instead of nesting a dl inside p', () => {
    const dom = new JSDOM(
      '<div id="wrap"><p id="root">TCP<br>: 面向连接的传输协议<br>: 提供可靠传输</p></div>',
    )
    const root = dom.window.document.querySelector('#root')

    transformRenderedDefinitionLists(root)

    const wrapper = dom.window.document.querySelector('#wrap')

    expect(wrapper.firstElementChild?.tagName).toBe('DL')
    expect(Array.from(wrapper.children).map((child) => child.tagName)).toEqual(['DL'])
  })

  it('replaces nested single-paragraph syntax inside a container', () => {
    const root = render(
      '<div class="el-p"><p><code>FD</code><br>: 文件描述符，或者一个特殊标记。<br>: 一般常见的有：<br>: - 数字 <code>0</code>、<code>1</code>、<code>2</code>，表示标准输入、标准输出和标准错误。<br>: - <code>cwd</code> 表示当前工作目录。<br>: - <code>txt</code> 表示程序代码段。<br>: - <code>mem</code> 表示内存映射文件。</p></div>',
    )

    const definitionList = root.querySelector('dl')

    expect(definitionList?.querySelector('dt')?.textContent).toBe('FD')
    expect(
      Array.from(definitionList?.querySelectorAll('dd p') ?? []).map(
        (node) => node.textContent,
      ),
    ).toEqual(['文件描述符，或者一个特殊标记。', '一般常见的有：'])
    expect(
      Array.from(definitionList?.querySelectorAll('dd ul li') ?? []).map(
        (node) => node.textContent,
      ),
    ).toEqual([
      '数字 0、1、2，表示标准输入、标准输出和标准错误。',
      'cwd 表示当前工作目录。',
      'txt 表示程序代码段。',
      'mem 表示内存映射文件。',
    ])
  })

  it('replaces single-paragraph syntax even when the wrapper has extra children', () => {
    const root = render(
      '<div class="el-p"><p>TCP<br>: 面向连接的传输协议<br>: 提供可靠传输</p><span class="metadata"></span></div>',
    )

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
