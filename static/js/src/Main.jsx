import React from 'react';
import ReactDOM from 'react-dom';
import { EditorState, Editor, CompositeDecorator, convertToRaw } from 'draft-js';

const names = ['John Smith', 'Jim Avery', 'Jonas Salk'];

export class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchingNames:false,
      editorState: EditorState.createEmpty()
    }
  }

  onChangeSearch = (e) => {
    const search = e.target.value;
    console.log('highlighting', search);
    this.setState({
      search,
      editorState: EditorState.set(this.state.editorState, { decorator: this.generateDecorator(search) }),
    });
  }

  onChangeReplace = (e) => {
    this.setState({
      replace: e.target.value,
    });
  }

  onReplace = () => {
    console.log(`replacing "${this.state.search}" with "${this.state.replace}"`);
  }
  
  addSelections(matches) {
    document.querySelector('.searchResults').innerHTML = '';
    let ul = document.createElement('ul');
    matches.forEach(match => {
      let li = document.createElement('li');
      li.innerHTML = match;
      ul.appendChild(li);
    });
    document.querySelector('.searchResults').appendChild(ul);
  }

  onChange = (editorState) => {
    
    const blocks = convertToRaw(editorState.getCurrentContent()).blocks;
    const text = blocks.map(block => (!block.text.trim() && '\n') || block.text).join('\n');
    if (text[text.length-1] == '@' && !this.state.searchingNames) {
      this.setState({
        searchingNames:true
      });
    }
    if (this.state.searchingNames && text.length) {
      let start = text.lastIndexOf('@')+1;
      let substr = text.substring(start, text.length);
      substr = substr.replace(/\s/g, '');
      let regex = new RegExp('^' + substr, 'i');
      let matches = [];
      let index = 0;
      names.forEach(function (name, index) {
        name = name.replace(/\s/g, '');
        let search = regex.exec(name);
        if (search) {
          console.log();
          matches.push(names[index]);
        }
      });
      if (matches.length) {
        this.setState({
          editorState: EditorState.set(this.state.editorState, { decorator: this.generateDecorator(regex) }),
        });
        this.addSelections(matches);
      }
    }
    
  }

  SearchHighlight = (props) => (
    <span className="search-and-replace-highlight">{props.children}</span>
  );

  generateDecorator = (highlightTerm) => {
    const regex = new RegExp(highlightTerm, 'g');
    return new CompositeDecorator([{
      strategy: (contentBlock, callback) => {
        if (highlightTerm !== '') {
          this.findWithRegex(regex, contentBlock, callback);
        }
      },
      component: this.SearchHighlight,
    }])
  }
  
  findWithRegex = (regex, contentBlock, callback) => {
    const text = contentBlock.getText();
    let matchArr, start, end;
    while ((matchArr = regex.exec(text)) !== null) {
      start = matchArr.index;
      end = start + matchArr[0].length;
      callback(start, end);
    }
  }

  render() {
    return (
      <div>
        <Editor
          editorState={this.state.editorState}
          onChange={this.onChange}
        />
        <div className="searchResults"></div>
      </div>
    );
  }
}