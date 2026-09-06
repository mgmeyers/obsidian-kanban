/**
 * ============================================================================
 * [실행 순서 #8] src/settings/TagColorSettings.tsx — "태그별 색상" 지정 UI
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-상호작용
 * 보드 설정 화면(SettingsModal)에서 특정 태그(#tag)마다 카드에 표시될 배경색/글자색을
 * 지정할 수 있게 해 주는 Preact 컴포넌트 모음입니다. 색상 선택은 react-colorful의
 * RgbaStringColorPicker를 팝오버 형태로 띄워 처리하고, 태그 목록의 추가/삭제/수정은
 * immutability-helper의 update() 스펙을 이용해 불변적으로 상태를 갱신합니다.
 * renderTagSettings()/cleanUpTagSettings()는 Preact 컴포넌트를 Obsidian이 관리하는
 * 순수 DOM 컨테이너(containerEl)에 마운트/언마운트하는 진입점이며, #5(Settings.ts)의
 * SettingsModal이 보드 설정 탭을 그릴 때 이 함수들을 호출합니다.
 * ============================================================================
 */
import { colord } from 'colord';
// immutability-helper: update(원본, 스펙)으로 원본을 직접 변경하지 않고 새 객체/배열을
// 만들어내는 유틸. 이 파일에서는 태그 색상 배열에 항목을 추가($push)/삭제($splice)/
// 특정 인덱스의 필드만 교체($set)하는 데 사용된다.
import update from 'immutability-helper';
import {
  render,
  unmountComponentAtNode,
  // Preact 훅(hook)들: React와 동일한 규칙(함수 컴포넌트 최상단에서만 호출, 조건문 안에서 호출 금지)을 따른다.
  useCallback, // 의존성 배열이 바뀌지 않는 한 동일한 함수 참조를 재사용(불필요한 리렌더/이펙트 재실행 방지)
  useEffect, // 렌더 이후 부수효과(side effect)를 실행. 두 번째 인자 배열이 []이면 마운트 시 1회만 실행
  useMemo, // 계산 비용이 큰 값을 의존성이 바뀔 때만 재계산하고, 그 사이엔 캐시된 값을 재사용
  useState, // 컴포넌트 로컬 상태를 선언. [state, setState] 튜플을 반환
} from 'preact/compat';
import { RgbaStringColorPicker } from 'react-colorful';
import useOnclickOutside from 'react-cool-onclickoutside';

import { Icon } from '../components/Icon/Icon';
import { c, generateInstanceId } from '../components/helpers';
import { TagColor, TagColorSetting, TagColorSettingTemplate } from '../components/types';
import { getParentBodyElement } from '../dnd/util/getWindow';
import { t } from '../lang/helpers';

// Item 컴포넌트(태그 한 줄)에 전달되는 props 타입.
interface ItemProps {
  defaultColors: { color: string; backgroundColor: string }; // 테마에서 계산해온 기본 색상(사용자가 값 지정 안 했을 때 미리보기용)
  deleteKey: () => void; // 이 태그 항목을 목록에서 삭제하는 콜백
  tagColorKey: TagColor; // { tagKey, color, backgroundColor } 형태의 현재 값
  updateKey: (tagKey: string, color: string, backgroundColor: string) => void; // 값이 바뀔 때 호출할 콜백
}

// 임의의 색상 문자열(hex, rgb 등)을 colord로 파싱해 rgba()/hex 두 가지 표현으로 정규화한다.
// 파싱 실패 시(잘못된 색상 문자열) null을 반환해 호출부가 무시하도록 한다.
export function colorToRgbaString(color: string) {
  const parsed = colord(color);

  if (!parsed.isValid()) {
    return null;
  }

  const rgba = parsed.toRgb();
  return {
    rgba: `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`,
    hexa: parsed.toHex(),
  };
}

export interface ColorPickerInputProps {
  color?: string; // 부모가 들고 있는 실제 저장값(없으면 undefined)
  setColor: (color: string) => void; // 색이 바뀔 때 부모 상태를 갱신하는 콜백
  defaultColor: string; // 값이 없을 때 보여줄 기본색
}

// 텍스트 입력창 + 클릭 시 나타나는 컬러 피커 팝업을 결합한 재사용 가능한 색상 입력 컴포넌트.
// TagColorSettings와 DateColorSettings(파일 #10) 양쪽에서 공유해서 사용한다.
export function ColorPickerInput({ color, setColor, defaultColor }: ColorPickerInputProps) {
  // localRGB/localHEX: 컬러피커(rgba 문자열 기반)와 텍스트 입력창(hex 표시)이 각각 필요로
  // 하는 두 가지 표현을 로컬 상태로 따로 들고 있는다. useState의 초기값은 최초 렌더 시 1회만 평가됨.
  const [localRGB, setLocalRGB] = useState(color || defaultColor);
  const [localHEX, setLocalHEX] = useState(color || defaultColor);
  // 컬러피커 팝업의 표시 여부를 토글하는 상태.
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  // useCallback: setColor가 바뀌지 않는 한 이 함수의 참조를 고정한다.
  // (자식인 RgbaStringColorPicker의 onChange prop에 매번 새 함수를 넘기지 않기 위함)
  const onChange = useCallback(
    (newColor: string) => {
      // 입력값이 비었으면 defaultColor로 대체해 항상 유효한 색을 파싱하도록 한다.
      const normalized = colorToRgbaString(newColor || defaultColor);
      if (normalized) {
        setLocalHEX(normalized.hexa);
        setLocalRGB(normalized.rgba);
        setColor(normalized.rgba); // 부모(TagSettings 등)의 실제 저장 상태를 갱신
      }
    },
    [setColor]
  );

  // 마운트 시 1회 실행: 부모로부터 전달받은 color(저장된 값)를 정규화하여 로컬 상태에 반영.
  // 의존성 배열이 []이므로 이후 color가 바뀌어도 이 이펙트는 재실행되지 않는다
  // (색 변경은 위 onChange 경로로만 로컬 상태에 반영됨).
  useEffect(() => {
    if (!color || !defaultColor) return;

    const normalized = colorToRgbaString(color || defaultColor);
    if (normalized) {
      setLocalRGB(normalized.rgba);
      setLocalHEX(normalized.hexa);
    }
  }, []);

  // react-cool-onclickoutside: 반환된 ref를 DOM 노드에 붙이면, 그 노드 바깥을 클릭했을 때
  // 콜백(여기서는 팝업 닫기)을 실행해 준다. "바깥 클릭 시 닫기" 패턴의 표준적인 구현.
  const clickOutsideRef = useOnclickOutside(() => {
    setIsPickerVisible(false);
  });

  return (
    <div ref={clickOutsideRef} className={c('color-picker-wrapper')}>
      {/* isPickerVisible이 true일 때만 컬러피커 팝업을 렌더링(조건부 렌더링) */}
      {isPickerVisible && (
        <div className={c('color-picker')}>
          <RgbaStringColorPicker color={localRGB} onChange={onChange} />
        </div>
      )}
      <input
        type="text"
        value={localHEX}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        onFocus={() => {
          setIsPickerVisible(true);
        }}
      />
    </div>
  );
}

// 태그 색상 목록의 한 행(row)을 렌더링. 태그명 입력 + 배경색/글자색 선택 + 실시간 미리보기.
function Item({ tagColorKey, deleteKey, updateKey, defaultColors }: ItemProps) {
  return (
    <div className={c('setting-item-wrapper')}>
      <div className={c('setting-item')}>
        <div className={`${c('setting-controls-wrapper')} ${c('tag-color-input')}`}>
          <div className={c('setting-input-wrapper')}>
            <div>
              <div className={c('setting-item-label')}>{t('Tag')}</div>
              <input
                type="text"
                placeholder="#tag"
                value={tagColorKey.tagKey}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  // 사용자가 '#'을 빼고 입력해도 자동으로 앞에 '#'을 붙여 태그 형식을 강제한다.
                  updateKey(
                    val[0] === '#' ? val : '#' + val,
                    tagColorKey.color,
                    tagColorKey.backgroundColor
                  );
                }}
              />
            </div>
            <div>
              <div className={c('setting-item-label')}>{t('Background color')}</div>
              <ColorPickerInput
                color={tagColorKey.backgroundColor}
                setColor={(color) => {
                  // 배경색만 교체하고 나머지(tagKey, color)는 그대로 유지해서 콜백에 전달.
                  updateKey(tagColorKey.tagKey, tagColorKey.color, color);
                }}
                defaultColor={defaultColors.backgroundColor}
              />
            </div>
            <div>
              <div className={c('setting-item-label')}>{t('Text color')}</div>
              <ColorPickerInput
                color={tagColorKey.color}
                setColor={(color) => {
                  // 글자색만 교체.
                  updateKey(tagColorKey.tagKey, color, tagColorKey.backgroundColor);
                }}
                defaultColor={defaultColors.color}
              />
            </div>
          </div>
          <div className={c('setting-toggle-wrapper')}>
            <div>
              {/* 실제 카드에서 태그가 어떻게 보일지 미리보기: 앞뒤에 더미 태그(#tag1, #tag2)를 두고
                  가운데에 현재 설정 중인 태그를 CSS 커스텀 프로퍼티(--tag-color 등)로 색칠해 보여준다. */}
              <div className={c('item-tags')}>
                <a className={`tag ${c('item-tag')}`}>#tag1</a>
                <a
                  className={`tag ${c('item-tag')}`}
                  style={{
                    '--tag-color': tagColorKey.color,
                    '--tag-background': tagColorKey.backgroundColor,
                  }}
                >
                  {tagColorKey.tagKey || '#tag'}
                </a>
                <a className={`tag ${c('item-tag')}`}>#tag2</a>
              </div>
            </div>
          </div>
        </div>
        <div className={c('setting-button-wrapper')}>
          {/* 휴지통 아이콘 클릭 시 이 행을 목록에서 제거 */}
          <div className="clickable-icon" onClick={deleteKey} aria-label={t('Delete')}>
            <Icon name="lucide-trash-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface TagSettingsProps {
  dataKeys: TagColorSetting[]; // 저장되어 있던 태그 색상 설정 배열(각 항목은 { id, data } 형태)
  onChange: (settings: TagColorSetting[]) => void; // 목록이 바뀔 때마다 실제 설정 파일에 반영하는 콜백
  portalContainer: HTMLElement; // (현재 이 컴포넌트 내부에서 직접 쓰이진 않지만) 팝오버 등을 위한 포털 대상
}

// 태그 색상 설정 전체 목록을 관리하는 최상위 컴포넌트. 추가/삭제/수정 로직이 모두 여기 모여 있다.
function TagSettings({ dataKeys, onChange }: TagSettingsProps) {
  // keys: 현재 화면에 렌더링 중인 태그 색상 설정 배열의 로컬 상태(부모 onChange와 별개로 즉시 렌더링 반영용).
  const [keys, setKeys] = useState(dataKeys);
  // defaultColors: useMemo로 "최초 1회만" 계산 — 실제 태그(<a class="tag ...">) 엘리먼트를
  // 화면 밖(보이지 않게)에 임시로 만들어 getComputedStyle로 테마가 적용된 기본 색상값을 읽어온 뒤
  // 바로 제거한다. 이렇게 하면 사용자가 색을 지정하지 않았을 때 테마 기본색을 미리보기로 보여줄 수 있다.
  const defaultColors = useMemo(() => {
    const wrapper = createDiv(c('item-tags'));
    const tag = wrapper.createEl('a', c('item-tag'));

    wrapper.style.position = 'absolute';
    wrapper.style.visibility = 'hidden';

    activeDocument.body.append(wrapper);

    const props = activeWindow.getComputedStyle(tag);
    const color = props.getPropertyValue('color').trim();
    const backgroundColor = props.getPropertyValue('background-color').trim();

    wrapper.remove();

    return {
      color,
      backgroundColor,
    };
  }, []); // 빈 의존성 배열 → 컴포넌트 최초 마운트 시 딱 한 번만 계산.

  // 목록이 바뀔 때 부모(onChange, 실제 저장)와 로컬 상태(setKeys, 화면 갱신)를 함께 갱신하는 공통 헬퍼.
  const updateKeys = (keys: TagColorSetting[]) => {
    onChange(keys);
    setKeys(keys);
  };

  // "태그 색상 추가" 버튼 클릭 시 실행: 새 빈 항목을 배열 끝에 추가한다.
  const newKey = () => {
    updateKeys(
      // immutability-helper 스펙: $push: [item] → 배열 끝에 item을 추가한
      // 새 배열을 반환 (Array.prototype.push와 달리 원본 배열은 변경하지 않음).
      update(keys, {
        $push: [
          {
            ...TagColorSettingTemplate,
            id: generateInstanceId(), // 각 항목을 구분할 고유 id(React/Preact의 key prop으로 사용)
            data: {
              tagKey: '',
              color: '',
              backgroundColor: '',
            },
          },
        ],
      })
    );
  };

  // 인덱스 i번 항목을 목록에서 삭제.
  const deleteKey = (i: number) => {
    updateKeys(
      // $splice: [[i, 1]] → 배열의 i번 위치에서 1개 원소를 제거(Array.splice(i, 1)과 동일한 효과를 불변적으로 수행).
      update(keys, {
        $splice: [[i, 1]],
      })
    );
  };

  // 커링(currying) 형태: updateTagColor(i)를 호출하면 "i번째 항목만 갱신하는 함수"가 반환된다.
  // Item 컴포넌트의 updateKey prop으로 넘겨 각 행이 자기 자신의 인덱스만 갱신하도록 한다.
  const updateTagColor =
    (i: number) => (tagKey: string, color: string, backgroundColor: string) => {
      updateKeys(
        // 중첩 경로 갱신: keys 배열의 [i] 번째 요소의 .data 객체 안의 세 필드를
        // 각각 $set으로 교체. 다른 인덱스나 다른 필드는 전혀 건드리지 않는다.
        update(keys, {
          [i]: {
            data: {
              tagKey: {
                $set: tagKey,
              },
              color: {
                $set: color,
              },
              backgroundColor: {
                $set: backgroundColor,
              },
            },
          },
        })
      );
    };

  return (
    <div className={c('tag-color-input-wrapper')}>
      <div className="setting-item-info">
        <div className="setting-item-name">{t('Tag colors')}</div>
        <div className="setting-item-description">
          {t('Set colors for tags displayed in cards.')}
        </div>
      </div>
      <div>
        {/* 배열의 각 항목을 Item 행으로 매핑. key={key.id}로 Preact의 재조정(reconciliation)이
            항목 삭제/추가 시에도 각 행을 올바르게 식별하도록 한다. */}
        {keys.map((key, index) => (
          <Item
            key={key.id}
            tagColorKey={key.data}
            deleteKey={() => deleteKey(index)}
            updateKey={updateTagColor(index)}
            defaultColors={defaultColors}
          />
        ))}
      </div>
      <button
        className={c('add-tag-color-button')}
        onClick={() => {
          newKey();
        }}
      >
        {t('Add tag color')}
      </button>
    </div>
  );
}

// Obsidian 설정 화면(순수 DOM 컨테이너)에 이 Preact 트리를 마운트하는 진입점.
// SettingsModal이 보드 설정 탭을 그릴 때 이 함수를 호출해 containerEl 안에 UI를 그려 넣는다.
export function renderTagSettings(
  containerEl: HTMLElement,
  keys: TagColorSetting[],
  onChange: (key: TagColorSetting[]) => void
) {
  render(
    <TagSettings
      dataKeys={keys}
      onChange={onChange}
      portalContainer={getParentBodyElement(containerEl)}
    />,
    containerEl
  );
}

// 설정 탭이 닫히거나 다른 탭으로 전환될 때 Preact 컴포넌트를 컨테이너에서 언마운트(정리)한다.
export function cleanUpTagSettings(containerEl: HTMLElement) {
  unmountComponentAtNode(containerEl);
}
