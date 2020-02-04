import React from 'react';
import ReactDOM from 'react-dom';
import { EditorState, Editor, SelectionState, CompositeDecorator, Modifier, genKey } from 'draft-js';

const HANDLE_REGEX = /\@\s*[\w\s]+/gi;
//const HASHTAG_REGEX = /\#\s*[\w\u0590-\u05ff]+/gi;
const HASHTAG_REGEX = /(^|\B)#(?![0-9_]+\b)([a-zA-Z0-9_]{1,30})(\b|\r)/gi
const IDEA_REGEX = /\<>\s*[\w\u0590-\u05ff\s]+/gi;

const names = ['Jim Avery', 'Bob Jenkins', 'Jonas Salk', 'Telly Savalas', 'Aaron Sorkin', 'Robert Untermeyer'];
const hashes = ['BlahBlah', 'Gencon2020', 'HappyBirthday', 'Pokemon', 'ZzZzZzZzZ', '123LetsGo'];
const relations = ['Archaeology', 'History', 'Machine Learning', 'Politics', 'Programming', 'Zoology'];
var suggestions = [];
var activeEditingKey;

export class Main extends React.Component {
  constructor() {
    super();
    const compositeDecorator = new CompositeDecorator([
      {
        strategy: this.person.bind(this),
        component: this.PersonSpan,
      },
      {
        strategy: this.hashtag.bind(this),
        component: this.HashtagSpan,
      },
      {
        strategy: this.relation.bind(this),
        component: this.RelationSpan,
      },
      {
				strategy: this.getEntityStrategy('IMMUTABLE_PERSON').bind(this),
				component: this.FinalizedPersonSpan
			},
      {
				strategy: this.getEntityStrategy('IMMUTABLE_HASHTAG').bind(this),
				component: this.FinalizedHashtagSpan
			},
      {
				strategy: this.getEntityStrategy('IMMUTABLE_RELATION').bind(this),
				component: this.FinalizedRelationSpan
			}
    ]);

    this.state = {
      editorState: EditorState.createEmpty(compositeDecorator),
      tagIndex:0,
      enteringPerson:false,
      enteringHashtag:false,
      enteringRelation:false,
      browsingSuggestions:false,
      searchCount:0
    };

    this.focus = () => this.refs.editor.focus();
    this.onChange = (editorState) => this.setState({editorState});
    
  }
  
  componentDidMount() {
    //document.write(JSON.stringify(names, undefined, 2));
    document.querySelectorAll('.info span')[0].innerHTML = JSON.stringify(names, undefined, 2);
    document.querySelectorAll('.info span')[1].innerHTML = JSON.stringify(hashes, undefined, 2);
    document.querySelectorAll('.info span')[2].innerHTML = JSON.stringify(relations, undefined, 2);
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
      if (!this.state.browsingSuggestions) {
        this.state.tagIndex = suggestions.length-1;
        this.state.browsingSuggestions = true;
        let currSpan = document.querySelectorAll('.searchResults li')[this.state.tagIndex];
        currSpan.focus();
      } else {
        if (this.state.tagIndex <= 0) {
          this.state.tagIndex = 0;
          this.state.browsingSuggestions = false;
          this.focus();
          return;
        }
        this.state.tagIndex--;
        let currSpan = document.querySelectorAll('.searchResults li')[this.state.tagIndex];
        currSpan.focus();
      }
    }
  }
  
  onEnter(event) {
    event.preventDefault();
    if (this.state.browsingSuggestions) {
      this.setState({
        tagIndex:0,
        browsingSuggestions:false
      });
      this.finalizeText(event.target.innerText);
    }
  }
  
  finalizeText(text) {

    let contentState = this.state.editorState.getCurrentContent();
    let selectionState = this.state.editorState.getSelection();
    const block = contentState.getBlockForKey(selectionState.getAnchorKey());
    
    let anchorPoint = 0;
    let delimiter = '';
    let immutableType = '';
    if (this.state.enteringPerson) {
      immutableType = 'IMMUTABLE_PERSON';
      delimiter = '@';
    }
    if (this.state.enteringHashtag) {
      immutableType = 'IMMUTABLE_HASHTAG';
      delimiter = '#';
    }
    if (this.state.enteringRelation) {
      immutableType = 'IMMUTABLE_RELATION';
      delimiter = '>';
    }
    for (let i=selectionState.focusOffset; i >=0; i--) {
      if (block.text[i] == delimiter) {
        if (this.state.enteringRelation) {
          if (block.text[i-1] == '<') {
            anchorPoint = i-1;
          }
        } else {
          anchorPoint = i;
        }
        break;
      }
    }
    let newSelectionState = new SelectionState({
      anchorKey: block.getKey(),
      anchorOffset: anchorPoint,
      focusKey: block.getKey(),
      focusOffset: selectionState.focusOffset,
    });
    
    contentState = Modifier.replaceText(
      contentState,
      newSelectionState,
      text
    );

    this.setState({
      editorState: EditorState.push(
        this.state.editorState,
        contentState,
      )
    });

    let newBlock = contentState.getBlockForKey(newSelectionState.getAnchorKey());
    newSelectionState = new SelectionState({
      anchorKey: newBlock.getKey(),
      anchorOffset: anchorPoint,
      focusKey: newBlock.getKey(),
      focusOffset: anchorPoint + text.length
    });
    
    let newContentState = contentState.createEntity('TOKEN', immutableType, {url:''});
    const entityKey = contentState.getLastCreatedEntityKey();
    newContentState = Modifier.applyEntity(
      newContentState,
      newSelectionState,
      entityKey
    );
    
    this.setState({
      editorState: EditorState.push(
        this.state.editorState,
        newContentState,
      )
    });
    
    const focusSelection = newSelectionState.merge({
      anchorOffset: anchorPoint + text.length,
      focusOffset: anchorPoint + text.length,
    });

    const newEditorState = EditorState.forceSelection(
      this.state.editorState,
      focusSelection
    );
    this.setState({ editorState: newEditorState });
    let cs = Modifier.insertText(
      this.state.editorState.getCurrentContent(),
      focusSelection,
      ' '
    );
    const spaced = EditorState.push(
        this.state.editorState,
        cs,
        ''
      );
    this.setState({ editorState: spaced });
    this.clearSelections();
    this.focus();
    console.log('finalized', text);
  }

  handleSuggestionPress(event) {
    event.preventDefault();
    switch(event.key) {
      case 'ArrowDown':
        this.onDownArrow(event);
        break;
      case 'ArrowUp':
        this.onUpArrow(event);
        break;
      case 'Tab':
      case 'Enter':
        this.onEnter(event);
        break;
    }
  }
  
 
  
  addSelections(type) {
    this.clearSelections();
    let ul = document.createElement('ul');
    let self = this;
    suggestions.forEach(function(match, index) {
      let li = document.createElement('li');
      li.tabIndex = index;
      li.onkeydown = self.handleSuggestionPress.bind(self);
      li.innerHTML = match;
      li.onclick = function(event) {
        self.state.browsingSuggestions = true;
        self.onEnter(event);
      }
      ul.appendChild(li);
    });
    document.querySelector('.searchResults').appendChild(ul);
    
    let contentState = this.state.editorState.getCurrentContent();
    let selectionState = this.state.editorState.getSelection();
    const block = contentState.getBlockForKey(selectionState.getAnchorKey());
    setTimeout(function() {
      let highlight = document.querySelector(type + '[data-matchkey="' + activeEditingKey + '"]');
      if (highlight) {
        document.querySelector('.searchResults').style.left = highlight.offsetLeft + 27 + 'px';
      } else {
        document.querySelector('.searchResults').style.left = '27px';
      }
      setTimeout(function() {
        document.querySelector('.searchResults').style.opacity = 1;
      }, 50);
    }, 50);
  }
  
  clearSelections() {
    document.querySelector('.searchResults').innerHTML = '';
    document.querySelector('.searchResults').style.opacity = 0;
  }
  
  person(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    let textSlice = '';
    let self = this;
    let exactMatch = null;
    while ((matchArr = HANDLE_REGEX.exec(text)) !== null) {
      start = matchArr.index;
      let end = start + matchArr[0].length;
      textSlice = text.slice(start+1, end).trim();
      let regex = new RegExp('^'+textSlice, 'ig');
      
      names.forEach(function (name, index) {
        if (name.toLowerCase() == textSlice.toLowerCase()) {
          matchArr = null;
          exactMatch = name;
        } else {
          let search = name.match(regex);
          if (search) {
            matches.push(name);
          }
        }
      });
    }
    if (exactMatch) {
      //have to delay a bit so onchange can update state
      setTimeout(function() {
        self.finalizeText(exactMatch);
      }, 50);
      return;
    }
    if (matches.length) {
      matches = [...new Set(matches)];
      suggestions = matches;
      this.addSelections('.person');
    } else {
      if (this.state.enteringPerson) {
        this.clearSelections();
      }
    }
    this.findWithRegex(HANDLE_REGEX, contentBlock, callback, 'person');
  }

  hashtag(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    let textSlice = '';
    let self = this;
    let exactMatch = null;
    while ((matchArr = HASHTAG_REGEX.exec(text)) !== null) {
      start = matchArr.index;
      let end = start + text.length;
      textSlice = (text.slice(start+1, end)).trimLeft();
      console.log('checking', textSlice);
      let regex = new RegExp('^'+textSlice, 'ig');
      hashes.forEach(function (hash, index) {
        if (hash.toLowerCase() == textSlice.toLowerCase()) {
          matchArr = null;
          exactMatch = hash;
        } else {
          let search = hash.match(regex);
          if (search) {
            matches.push(hash);
          }
        }
      });
    }
    this.findWithRegex(HASHTAG_REGEX, contentBlock, callback, 'hashtag');
    if (exactMatch) {
      //have to delay a bit so onchange can update state
      setTimeout(function() {
        self.finalizeText(exactMatch);
      }, 50);
      return;
    }
    if (matches.length) {
      matches = [...new Set(matches)];
      suggestions = matches;
      this.addSelections('.hashtag');
    } else {
      if (this.state.enteringHashtag) {
        console.log('clearing hashes');
        this.clearSelections();
      }
    }
    
  }

  relation(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    let textSlice = '';
    let self = this;
    let exactMatch = null;
    while ((matchArr = IDEA_REGEX.exec(text)) !== null) {
      start = matchArr.index;
      let end = start + matchArr[0].length;
      textSlice = text.slice(start+2, end).trim();
      let regex = new RegExp('^'+textSlice, 'ig');
      relations.forEach(function (relation, index) {
        if (relation.toLowerCase() == textSlice.toLowerCase()) {
          matchArr = null;
          exactMatch = relation;
        } else {
          let search = relation.match(regex);
          if (search) {
            matches.push(relation);
          }
        }
      });
    }
    if (exactMatch) {
      //have to delay a bit so onchange can update state
      setTimeout(function() {
        self.finalizeText(exactMatch);
      }, 50);
      return;
    }
    if (matches.length) {
      matches = [...new Set(matches)];
      suggestions = matches;
      this.addSelections('.relation');
    } else {
      if (this.state.enteringRelation) {
        this.clearSelections();
      }
    }
    this.findWithRegex(IDEA_REGEX, contentBlock, callback, 'relation');
  }

  getEntityStrategy(mutability) {
    return function(contentBlock, callback, contentState) {
      contentBlock.findEntityRanges((character) => {
        const entityKey = character.getEntity();
        if (entityKey === null) {
          return false;
        }
        return contentState.getEntity(entityKey).getMutability() === mutability;
      }, callback);
    };
  }

  findWithRegex(regex, contentBlock, callback, type) {
    const text = contentBlock.getText();
    let self = this;
    let matchArr, start;
    while ((matchArr = regex.exec(text)) !== null) {
      start = matchArr.index;
      switch(type) {
        case 'person':
          self.setState({
            enteringPerson:true,
            enteringHashtag:false,
            enteringRelation:false
          });
          break;
        case 'hashtag':
          self.setState({
            enteringPerson:false,
            enteringHashtag:true,
            enteringRelation:false
          });
          break;
        case 'relation':
          self.setState({
            enteringPerson:false,
            enteringHashtag:false,
            enteringRelation:true
          });
          break;
      }
      callback(start, start + matchArr[0].length);
    }
  }

  PersonSpan = (props) => {
    activeEditingKey = genKey();
    return (
      <span
        className='person'
        data-offset-key={props.offsetKey}
        data-matchkey={activeEditingKey}
        >
        {props.children}
      </span>
    );
  };

  HashtagSpan = (props) => {
    activeEditingKey = genKey();
    return (
      <span
        className="hashtag"
        data-offset-key={props.offsetKey}
        data-matchkey={activeEditingKey}
        >
        {props.children}
      </span>
    );
  };

  RelationSpan = (props) => {
    activeEditingKey = genKey();
    return (
      <span
        className="relation"
        data-offset-key={props.offsetKey}
        data-matchkey={activeEditingKey}
        >
        {props.children}
      </span>
    );
  };
  
  FinalizedPersonSpan = (props) => {
    return (
      <span
        className={'final person'}
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };
  
  FinalizedHashtagSpan = (props) => {
    return (
      <span
        className={'final hashtag'}
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };
  
  FinalizedRelationSpan = (props) => {
    return (
      <span
        className={'final relation'}
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };

  render() {
    return (
      <div>
        
        <div onClick={this.focus} className="editorContainer">
          <Editor
            onDownArrow={this.onDownArrow.bind(this)}
            onUpArrow={this.onUpArrow.bind(this)}
            editorState={this.state.editorState}
            onChange={this.onChange}
            placeholder="Write something..."
            ref="editor"
            />
        </div>
        <div className="searchResults"></div>
        <div className="info"><h4>Available Names:</h4><span className="nameDisplay"></span></div>
        <div className="info"><h4>Available Hashtags:</h4><span className="hashDisplay"></span></div>
        <div className="info"><h4>Available Relations:</h4><span className="relationsDisplay"></span></div>
      </div>
    );
  }
}

