import React from 'react';
import ReactDOM from 'react-dom';
import {EditorState, Editor, SelectionState, CompositeDecorator, Modifier} from 'draft-js';

const HANDLE_REGEX = /@(\w)+( \t)?(\w)*(?!(@#<))/gi
const HASHTAG_REGEX = /#(\w)+(?!(<#@))*/gi
const IDEA_REGEX = /<>(\w)+( \t)?(\w)*(?!(@#<))/gi

const PERSON_TYPE = 'person';
const HASHTAG_TYPE = 'hashtag';
const RELATION_TYPE = 'relation';
const IMMUTABLE_PERSON_ENTITY = 'personEntity';
const IMMUTABLE_HASHTAG_ENTITY = 'hashtagEntity';
const IMMUTABLE_RELATION_ENTITY = 'relationEntity';

const names = ['Jim Avery', 'Bob Jenkins', 'Jonas Salk', 'Telly Savalas', 'Aaron Sorkin', 'Robert Untermeyer'];
const hashes = ['BlahBlah', 'Gencon2020', 'HappyBirthday', 'Pokemon', 'ZzZzZzZzZ', '123LetsGo'];
const relations = ['Archaeology', 'History', 'Machine Learning', 'Politics', 'Programming', 'Zoology'];

var activeEditingKey;
var searchList = React.createRef();
var searchListDOM = React.createRef();
const ListItem = React.forwardRef((props, ref) => (<li tabIndex={props.tabIndex} onClick={props.onClick} onKeyDown={props.onKeyDown} ref={ref}>{props.value}</li>));

export class SearchList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      items:props.items,
      searchVisible:0
    }
    this.onItemClick = props.onItemClick;
    this.onItemPress = props.onItemPress;
  }
  
  liRefs = {};

  componentWillReceiveProps(props) {
    this.setState({
      items: props.items
    });
  }

  render() {
    return(
      <ul ref={searchListDOM} style={{opacity:this.state.searchVisible}}>
        {this.state.items.map((item, index ) => {
          this.liRefs[index] = React.createRef();
          return (
            <ListItem key={index} tabIndex={index} ref={this.liRefs[index]} value={item} onClick={this.onItemClick} onKeyDown={this.onItemPress}/>
          );
        })}
      </ul>
    );
  }
}

export class Main extends React.Component {
  constructor() {
    super();
    const compositeDecorator = new CompositeDecorator([
      {
        strategy: this.person.bind(this),
        component: PersonSpan,
      },
      {
        strategy: this.hashtag.bind(this),
        component: HashtagSpan,
      },
      {
        strategy: this.relation.bind(this),
        component: RelationSpan,
      },
      {
        strategy: this.getEntityStrategy(IMMUTABLE_PERSON_ENTITY).bind(this),
        component: FinalizedPersonSpan
      },
      {
        strategy: this.getEntityStrategy(IMMUTABLE_HASHTAG_ENTITY).bind(this),
        component: FinalizedHashtagSpan
      },
      {
        strategy: this.getEntityStrategy(IMMUTABLE_RELATION_ENTITY).bind(this),
        component: FinalizedRelationSpan
      }
    ]);
    this.state = {
      editorState: EditorState.createEmpty(compositeDecorator),
      suggestions:[]
    };
    this.suggestionsType = null;
    this.focus = () => this.refs.editor.focus();
    this.onChange = (editorState) => this.setState({editorState});
    
    this.tagIndex=-1;
    this.browsingSuggestions = false;
  }
  
  componentDidMount() {
    document.querySelectorAll('.info span')[0].innerHTML = JSON.stringify(names, undefined, 2);
    document.querySelectorAll('.info span')[1].innerHTML = JSON.stringify(hashes, undefined, 2);
    document.querySelectorAll('.info span')[2].innerHTML = JSON.stringify(relations, undefined, 2);
  }
  
  
  // If down arrow is pressed, and the list is not being browsed, go to the first option.
  // If we're at the bottom of the list, return focus to the editor.
  // Otherwise, jump down the list.
  onDownArrow(event) {
    event.preventDefault();
    if (this.state.suggestions.length) {
      if (this.tagIndex > this.state.suggestions.length-2) {
        this.tagIndex = -1;
        this.browsingSuggestions = false;
        this.focus();
        return;
      }
      this.tagIndex++;
      this.browsingSuggestions = true;
      searchList.current.liRefs[this.tagIndex].current.focus();
      
    }
  }
  
  // If up arrow is pressed, and the list is not being browsed, go to the last option.
  // If we're at the top of the list, return focus to the editor.
  // Otherwise, jump up the list.
  onUpArrow(event) {
    event.preventDefault();
    if (this.state.suggestions.length) {
      if (this.tagIndex <= 0) {
        this.tagIndex = -1;
        this.browsingSuggestions = false;
        this.focus();
        return;
      }
      this.tagIndex--;
      this.browsingSuggestions = true;
      searchList.current.liRefs[this.tagIndex].current.focus();
      
    }
  }
  
  // Handler for both enter and tab keys.
  onEnter(event) {
    event.preventDefault();
    if (this.browsingSuggestions) {
      this.tagIndex = -1;
      this.browsingSuggestions = false;
      this.finalizeText(event.target.innerText, this.suggestionsType);
    }
  }
  
  handleKeyCommand(command) {
    if (command == 'split-block') {
      this.clearSelections(PERSON_TYPE);
      this.clearSelections(HASHTAG_TYPE);
      this.clearSelections(RELATION_TYPE);
    }
  }
  
  // User has entered text which matches something in one of our lists.
  // We will style it and make it immutable.
  finalizeText(text, type) {
    this.clearSelections(type);
    this.focus();
    
    let contentState = this.state.editorState.getCurrentContent();
    let selectionState = this.state.editorState.getSelection();
    const block = contentState.getBlockForKey(selectionState.getAnchorKey());
    
    // Find the delimiter to use as anchor start point.
    let anchorPoint = 0;
    let delimiter = '';
    let immutableType = '';
    switch(type) {
      case PERSON_TYPE:
        immutableType = IMMUTABLE_PERSON_ENTITY;
        delimiter = '@';
        break;
      case HASHTAG_TYPE:
        immutableType = IMMUTABLE_HASHTAG_ENTITY;
        delimiter = '#';
        break;
      case RELATION_TYPE:
        immutableType = IMMUTABLE_RELATION_ENTITY;
        delimiter = '>';
        break;
    }

    // Start at the cursor and loop backwards until we find our delimiter character.
    for (let i=selectionState.focusOffset; i >=0; i--) {
      if (block.text[i] == delimiter) {
        if (type == RELATION_TYPE) {
          if (block.text[i-1] == '<') {
            anchorPoint = i-1;
          }
        } else {
          anchorPoint = i;
        }
        break;
      }
    }
    
    // Select our range and replace it with the properly formatted text from our list.
    let newSelectionState = new SelectionState({
      anchorKey: block.getKey(),
      anchorOffset: anchorPoint,
      focusKey: block.getKey(),
      focusOffset: selectionState.focusOffset,
    });
    contentState = Modifier.replaceText(
      contentState,
      newSelectionState,
      text + ' '
    );
    this.setState({
      editorState: EditorState.push(
        this.state.editorState,
        contentState,
      )
    }, function() {
      
      // Make the formatted text immutable and give it styles.
      let newBlock = contentState.getBlockForKey(newSelectionState.getAnchorKey());
      newSelectionState = new SelectionState({
        anchorKey: newBlock.getKey(),
        anchorOffset: anchorPoint,
        focusKey: newBlock.getKey(),
        focusOffset: anchorPoint + text.length
      });
      let newContentState = contentState.createEntity('TOKEN', immutableType, {ignored:'true'});
      const entityKey = newContentState.getLastCreatedEntityKey();
      newContentState = Modifier.applyEntity(
        contentState,
        newSelectionState,
        entityKey
      );
      this.setState({
        editorState: EditorState.push(
          this.state.editorState,
          newContentState,
        )
      }, function() {
        const focusSelection = newSelectionState.merge({
          anchorOffset: anchorPoint + text.length+1,
          focusOffset: anchorPoint + text.length+1,
        });
        const newEditorState = EditorState.forceSelection(
          this.state.editorState,
          focusSelection
        );
        this.setState({ editorState: newEditorState });
      });
    });
  }

  // button handlers for the list options
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
  

  
  // Generate the selectable dropdown from the matched user input.
  addSelections(type) {
    setTimeout(function() {
      let ul = searchListDOM.current;
      if (!searchList.current.state.searchVisible) { 
          let highlight = document.querySelector('.' + type + '[data-offset-key="' + activeEditingKey + '"]');
          console.log('hl', highlight);
          console.log(activeEditingKey);
          if (highlight) {
            ul.style.left = highlight.offsetLeft + 27 + 'px';
            ul.style.top = 100 + highlight.parentNode.parentNode.offsetTop + 40 + 'px';
          } else {
            ul.style.left = '27px';
            ul.style.top = 100 + 40 + 'px';
          }
          
        searchList.current.setState({
          searchVisible:1
        });
      }
    }, 50);
  }
  
  // Remove the list box.
  clearSelections(type) {
    if (type == this.suggestionsType) {
      console.log('clearing', type);
      searchList.current.setState({
        searchVisible:0
      });
    }
  }
  
  getSuggestions(contentBlock, contentState, type) {
    
    let regex, suggestionsArr, startOffset = 1;
    switch(type) {
      case PERSON_TYPE:
        regex = HANDLE_REGEX;
        suggestionsArr = names;
        break;
      case HASHTAG_TYPE:
        regex = HASHTAG_REGEX;
        suggestionsArr = hashes;
        break;
      case RELATION_TYPE:
        regex = IDEA_REGEX;
        suggestionsArr = relations;
        startOffset = 2;
        break;
    }
    
    const text = contentBlock.getText();
    let matchArr, matches = [];
    let reg = new RegExp(regex);
    while ((matchArr = reg.exec(text)) !== null) {
      let start = matchArr.index;
      let end = start + matchArr[0].length;
      let entpos = this.checkForEntity(contentBlock, contentState, start, end);
      if (entpos !== null) {
        end = entpos;
      }
      let textSlice = text.slice(start+startOffset, end).trim();
      let regex = new RegExp('^'+textSlice, 'ig');
      let exactMatch = null;
      suggestionsArr.forEach(function (suggestion, index) {
        if (suggestion.toLowerCase() == textSlice.toLowerCase()) {
          exactMatch = suggestion;
        } else {
          let search = suggestion.match(regex);
          if (search) {
            matches.push(suggestion);
          }
        }
      });
      if (exactMatch) {
        return exactMatch;
      }
      return matches;
    }
    return null;
  }
  
  // Matching type person, indicated by @ character.
  person(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    
    let list = this.getSuggestions(contentBlock, contentState, PERSON_TYPE);
    if (list) {
      this.suggestionsType = PERSON_TYPE;
      if (!Array.isArray(list)) {
        this.finalizeText(list, PERSON_TYPE);
      } else {
        if (list.length) {
          this.setState({
            suggestions:[...new Set(list)]
          });
          this.addSelections(PERSON_TYPE);
        } else {
          this.clearSelections(PERSON_TYPE);
        }
      }
    } else {
      this.clearSelections(PERSON_TYPE);
    }
    this.findWithRegex(HANDLE_REGEX, contentBlock, callback, contentState);
  }

  // Matching type hashtag indicated by # character.
  hashtag(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    let list = this.getSuggestions(contentBlock, contentState, HASHTAG_TYPE);
    if (list) {
      this.suggestionsType = HASHTAG_TYPE;
      if (!Array.isArray(list)) {
        this.finalizeText(list, HASHTAG_TYPE);
      } else {
        if (list.length) {
          this.setState({
            suggestions:[...new Set(list)]
          });
          this.addSelections(HASHTAG_TYPE);
        } else {
          this.clearSelections(HASHTAG_TYPE);
        }
      }
    } else {
      this.clearSelections(HASHTAG_TYPE);
    }
    this.findWithRegex(HASHTAG_REGEX, contentBlock, callback, contentState);
  }

  // Matching type relation indicated by '<>' characters.
  relation(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    let list = this.getSuggestions(contentBlock, contentState, RELATION_TYPE);
    if (list) {
      this.suggestionsType = RELATION_TYPE;
      if (!Array.isArray(list)) {
        this.finalizeText(list, RELATION_TYPE);
      } else {
        if (list.length) {
          this.setState({
            suggestions:[...new Set(list)]
          });
          this.addSelections(RELATION_TYPE);
        } else {
          this.clearSelections(RELATION_TYPE);
        }
      }
    } else {
      this.clearSelections(RELATION_TYPE);
    }
    this.findWithRegex(IDEA_REGEX, contentBlock, callback, contentState);
  }

  // callback to render immutable entities
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
  
  checkForEntity(contentBlock, contentState, start, end) {
    let entStart = null;
    for (let i=start; i < end; i++) {
      let entKey = contentBlock.getEntityAt(i);
      if (entKey) {
        let ent = contentState.getEntity(entKey);
        if (ent.data.ignored == 'true') {
          entStart = i;
          break;
        }
      }
    }
    return entStart;
  }

  findWithRegex(regex, contentBlock, callback, contentState ) {
    const text = contentBlock.getText();
    let match;
    regex = new RegExp(regex);
    while ((match = regex.exec(text)) !== null) {
      let start = match.index;
      let end = start + match[0].length;
      let entpos = this.checkForEntity(contentBlock, contentState, start, end);
      if (entpos === null) {
        callback(start, end);
      } else {
        callback(start, entpos);
      }
    }
  }

  render() {
    return (
      <div>
        <div onClick={this.focus} className="editorContainer">
          <Editor
            handleKeyCommand={this.handleKeyCommand.bind(this)}
            onDownArrow={this.onDownArrow.bind(this)}
            onUpArrow={this.onUpArrow.bind(this)}
            editorState={this.state.editorState}
            onChange={this.onChange}
            placeholder="Write something..."
            ref="editor"
            />
        </div>
        <SearchList ref={searchList} items={this.state.suggestions} onItemClick={this.handleSuggestionPress.bind(this)} onItemPress={this.handleSuggestionPress.bind(this)}></SearchList>
        <div className="info"><h4>Available Names:</h4><span className="nameDisplay"></span></div>
        <div className="info"><h4>Available Hashtags:</h4><span className="hashDisplay"></span></div>
        <div className="info"><h4>Available Relations:</h4><span className="relationsDisplay"></span></div>
      </div>
    );
  }
  
  
}



const PersonSpan = props => {
  activeEditingKey = props.offsetKey;
  return (
    <span className={PERSON_TYPE} data-offset-key={activeEditingKey}>
      {props.children}
    </span>
  );
};


const HashtagSpan = props => {
  activeEditingKey = props.offsetKey;
  return (
    <span className={HASHTAG_TYPE} data-offset-key={activeEditingKey}>
      {props.children}
    </span>
  );
};

const RelationSpan = props => {
  activeEditingKey = props.offsetKey;
  return (
    <span className={RELATION_TYPE} data-offset-key={activeEditingKey}>
      {props.children}
    </span>
  );
};

const FinalizedPersonSpan = props => {
  return (
    <span className={'final ' + PERSON_TYPE}>
      {props.children}
    </span>
  );
};

const FinalizedHashtagSpan = props => {
  return (
    <span className={'final ' + HASHTAG_TYPE}>
      {props.children}
    </span>
  );
};

const FinalizedRelationSpan = props => {
  return (
    <span className={'final ' + RELATION_TYPE}>
      {props.children}
    </span>
  );
};
