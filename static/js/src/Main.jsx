import React from 'react';
import ReactDOM from 'react-dom';
import { EditorState, Editor, SelectionState, CompositeDecorator, Modifier } from 'draft-js';

const HANDLE_REGEX = /\@[\w\s]+/gi;
const HASHTAG_REGEX = /\#[\w\u0590-\u05ff]+/gi;
const IDEA_REGEX = /\<>[\w\u0590-\u05ff]+/gi;
const FINALIZE_REGEX = /\%%%[\w\s]+%%%/gi;

const names = ['jonas salk', 'jim avery', 'bob jenkins'];
var suggestions = [];

export class Main extends React.Component {
  constructor() {
    super();
    const compositeDecorator = new CompositeDecorator([
      {
        strategy: this.handleStrategy.bind(this),
        component: this.HandleSpan,
      },
      {
        strategy: this.hashtagStrategy.bind(this),
        component: this.HashtagSpan,
      },
      {
        strategy: this.ideaStrategy.bind(this),
        component: this.IdeaSpan,
      },
      {
        strategy: this.handleFinalize.bind(this),
        component: this.FinalizeSpan,
      },
    ]);

    this.state = {
      editorState: EditorState.createEmpty(compositeDecorator),
      tagIndex:0,
      browsingSuggestions:false,
      currentBlock:null
    };

    this.focus = () => this.refs.editor.focus();
    this.onChange = (editorState) => this.setState({editorState});
    
  }
  
  onDownArrow(event) {
    event.preventDefault();
    if (suggestions.length) {
      if (this.state.tagIndex > suggestions.length-1) {
        this.setState({
          tagIndex:0,
          browsingSuggestions:false
        });
        this.focus();
        return;
      }
      this.state.browsingSuggestions = true;
      let currSpan = document.querySelectorAll('.searchResults li')[this.state.tagIndex];
      currSpan.focus();
      this.state.tagIndex++;
      
    }
  }
  
  onUpArrow(event) {
    event.preventDefault();
    if (suggestions.length) {
      this.state.tagIndex-=2;
      if (this.state.tagIndex < 0) {
        this.setState({
          tagIndex:0,
          browsingSuggestions:false
        });
        this.focus();
        return;
      }
      this.state.browsingSuggestions = true;
      let currSpan = document.querySelectorAll('.searchResults li')[this.state.tagIndex];
      currSpan.focus();
      this.state.tagIndex--;
    }
  }
  
  onEnter(event) {
    event.preventDefault();
    if (this.state.browsingSuggestions) {
      this.setState({
        tagIndex:0,
        browsingSuggestions:false
      });
      this.focus();
      this.clearSelections();
      let text = event.target.innerText;
      
      let selectionState = this.state.editorState.getSelection();
      var anchorKey = selectionState.getAnchorKey();
      var currentContent = this.state.editorState.getCurrentContent();
      var currentContentBlock = currentContent.getBlockForKey(anchorKey);
      console.log(anchorKey, currentContent);
      console.log('curr', currentContent.anchorOffset, currentContentBlock.focusOffset);
      currentContent = Modifier.replaceText(
        currentContent,
        new SelectionState({
          anchorKey: currentContentBlock.getKey(),
          anchorOffset: 0,
          focusKey: currentContentBlock.getKey(),
          focusOffset: currentContentBlock.text.length
        }),
        '%%%'+text+'%%%'
      );
      this.clearSelections();
      this.setState({
        editorState: EditorState.push(
          this.state.editorState,
          currentContent,
        )
      });
    }
  }

  render() {
    return (
      <div>
        <div onClick={this.focus}>
          <Editor
            onDownArrow={this.onDownArrow.bind(this)}
            editorState={this.state.editorState}
            onChange={this.onChange}
            placeholder="Write something..."
            ref="editor"
            />
        </div>
        <div className="searchResults"></div>
      </div>
    );
  }
  
  handleSuggestionPress(event, block) {
    console.log('blk', this.state.currentBlock);
    event.preventDefault();
    console.log('pressed span');
    console.log('evt', event);
    switch(event.key) {
      case 'ArrowDown':
      case 'Tab':
        this.onDownArrow(event);
        break;
      case 'ArrowUp':
        this.onUpArrow(event);
        break;
      case 'Enter':
        this.onEnter(event);
        break;
    }
  }
  
  addSelections(type) {
    document.querySelector('.searchResults').innerHTML = '';
    let ul = document.createElement('ul');
    let self = this;
    suggestions.forEach(function(match, index) {
      let li = document.createElement('li');
      li.tabIndex = index;
      li.onkeydown = self.handleSuggestionPress.bind(self);
      li.innerHTML = match;
      ul.appendChild(li);
    });
    document.querySelector('.searchResults').appendChild(ul);
    let highlight = document.querySelector(type);
    if (highlight) {
      document.querySelector('.searchResults').style.left = highlight.offsetLeft + 27 + 'px';
    }
  }
  
  clearSelections() {
    document.querySelector('.searchResults').innerHTML = '';
  }
  
  handleFinalize(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let matchArr, start, end;
    while ((matchArr = FINALIZE_REGEX.exec(text)) !== null) {
      start = matchArr.index;
      end = start + matchArr[0].length;
    }

    const contentStateWithEntity = contentState.createEntity('LINK', 'IMMUTABLE', {
      url: 'http://www.zombo.com',
    });
    const entityKey = contentStateWithEntity.getLastCreatedEntityKey();
    const contentStateWithLink = Modifier.applyEntity(
      contentStateWithEntity,
      new SelectionState({
        anchorKey: contentBlock.getKey(),
        anchorOffset: 0,
        focusKey: contentBlock.getKey(),
        focusOffset: 2
      }),
      entityKey,
    );
    EditorState.push(this.state.editorState, {
      currentContent: contentStateWithLink,
    });
    callback(start, end);

    //this.findWithRegex(FINALIZE_REGEX, contentBlock, callback);
  }
  
  handleStrategy(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    let textSlice = '';
    this.setState({
      suggestions:[],
      tagIndex:0
    });
    let self = this;
    while ((matchArr = HANDLE_REGEX.exec(text)) !== null) {
      start = matchArr.index;
      let end = start + matchArr[0].length;
      textSlice = text.slice(start+1, end);
      let regex = new RegExp('^'+textSlice, 'ig');
      
      names.forEach(function (name, index) {
        let search = name.match(regex);
        console.log(search);
        if (search) {
          matches.push(name);
        }
      });
    }
    if (matches.length) {
      suggestions = matches;
      this.setState({
        currentBlock:contentBlock
      });
      this.addSelections('.handle');
    } else {
      this.setState({
        currentBlock:null
      });
      this.clearSelections();
    }
    this.findWithRegex(HANDLE_REGEX, contentBlock, callback);
  }

  hashtagStrategy(contentBlock, callback, contentState) {
    this.findWithRegex(HASHTAG_REGEX, contentBlock, callback);
  }

  ideaStrategy(contentBlock, callback, contentState) {
    this.findWithRegex(IDEA_REGEX, contentBlock, callback);
  }



  findWithRegex(regex, contentBlock, callback) {
    const text = contentBlock.getText();
    let matchArr, start;
    while ((matchArr = regex.exec(text)) !== null) {
      start = matchArr.index;
      console.log(matchArr);
      callback(start, start + matchArr[0].length);
    }
  }

  HandleSpan = (props) => {
    return (
      <span
        className="handle"
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };

  HashtagSpan = (props) => {
    return (
      <span
        className="hashtag"
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };

  IdeaSpan = (props) => {
    return (
      <span
        className="idea"
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };
  
  FinalizeSpan = (props) => {
    return (
      <span
        className="final"
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };

}



