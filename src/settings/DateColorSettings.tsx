/**
 * ============================================================================
 * [실행 순서 #10] src/settings/DateColorSettings.tsx — "마감일 기준 색상 규칙" 지정 UI
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-상호작용
 * 보드 설정 화면(SettingsModal)에서 카드에 표시되는 날짜(예: 마감일)를 규칙에 따라
 * 색칠하기 위한 Preact 컴포넌트 모음입니다. "오늘이면", "이전/이후", "지금과 N일/시간/주/
 * 개월 사이" 같은 조건(select + 숫자 입력 + 방향 select)을 조합해 하나의 규칙을 만들고,
 * 규칙마다 배경색/글자색을 ColorPickerInput(파일 #8, TagColorSettings.tsx에서 정의)으로
 * 재사용해 지정한다. 목록의 추가/삭제/수정은 #8과 마찬가지로 immutability-helper의
 * update() 스펙으로 처리되며, renderDateSettings()/cleanUpDateSettings()가 SettingsModal에서
 * 이 Preact 트리를 컨테이너 DOM에 마운트/언마운트하는 진입점 역할을 한다.
 * ============================================================================
 */
import classcat from 'classcat';
// immutability-helper: 배열/객체를 직접 변경(mutate)하지 않고 새 값을 만들어내는 헬퍼.
// 이 파일에서는 규칙 배열에 새 규칙을 추가($push), 특정 규칙을 삭제($splice), 특정 인덱스의
// data 전체를 교체($set)하는 데 사용된다.
import update from 'immutability-helper';
import { moment } from 'obsidian';
// 이 파일은 TagColorSettings.tsx와 달리 훅을 개별 이름으로 import하지 않고, Preact 네임스페이스
// 전체를 가져와 Preact.useState, Preact.render 등으로 접근한다(기능적으로는 동일).
import Preact from 'preact/compat';

import { Icon } from '../components/Icon/Icon';
import { c, generateInstanceId } from '../components/helpers';
import { DateColor, DateColorSetting, DateColorSettingTemplate } from '../components/types';
import { getParentBodyElement } from '../dnd/util/getWindow';
import { t } from '../lang/helpers';
// 배경색/글자색 입력 위젯은 TagColorSettings.tsx(#8)에서 만든 것을 그대로 재사용한다.
import { ColorPickerInput } from './TagColorSettings';

// Item(규칙 한 줄) 컴포넌트에 전달되는 props 타입.
interface ItemProps {
  dateColorKey: DateColor; // 이 규칙의 현재 값(조건 플래그, 거리, 단위, 방향, 색상 등)
  deleteKey: () => void; // 이 규칙을 목록에서 삭제하는 콜백
  updateKey: (newKey: DateColor) => void; // 규칙 전체 객체를 통째로 교체하는 콜백(TagColorSettings와 달리 필드별이 아니라 객체 전체를 넘김)
  defaultColors: { color: string; backgroundColor: string }; // 테마 기본 색상(미리보기용)
  getTimeFormat: () => string; // 카드에 실제로 쓰이는 시간 포맷 문자열을 얻는 함수(미리보기 렌더링용)
  getDateFormat: () => string; // 카드에 실제로 쓰이는 날짜 포맷 문자열을 얻는 함수(미리보기 렌더링용)
}

// 날짜 색상 규칙 하나를 렌더링: "날짜가 [조건]" 드롭다운 + (조건에 따라) 숫자/단위/방향
// 입력 + 배경색/글자색 선택 + 실시간 미리보기(오늘 날짜를 규칙 색으로 칠해서 보여줌).
function Item({
  dateColorKey,
  deleteKey,
  updateKey,
  defaultColors,
  getTimeFormat,
  getDateFormat,
}: ItemProps) {
  // 현재 저장된 규칙의 불리언 플래그들(isToday/isBefore/isAfter)을 보고 select의 기본 선택값을
  // 역산한다. 셋 다 false/undefined이면 "between"(지금과 N 사이) 조건으로 간주한다.
  let defaultSelectorValue = 'between';

  if (dateColorKey.isToday) defaultSelectorValue = 'today';
  if (dateColorKey.isBefore) defaultSelectorValue = 'before';
  if (dateColorKey.isAfter) defaultSelectorValue = 'after';

  return (
    <div className={c('setting-item-wrapper')}>
      <div className={c('setting-item')}>
        <div className={`${c('setting-controls-wrapper')} ${c('tag-color-input')}`}>
          <div>
            <div>
              <div className={c('setting-item-label')}>{t('Date is')}</div>
            </div>
            <div className={c('date-color-config')}>
              {/* 조건 종류를 고르는 드롭다운: between / today / after / before.
                  defaultValue만 지정하고 value를 지정하지 않은 "비제어(uncontrolled)" select이므로,
                  실제 선택 상태는 DOM이 들고 있고 이 컴포넌트는 onChange 이벤트로만 값 변화를 감지한다. */}
              <select
                className="dropdown"
                defaultValue={defaultSelectorValue}
                onChange={(e) => {
                  // 기존 규칙을 얕은 복사(spread)한 뒤, 조건 관련 플래그 3개를 모두 제거하고
                  // 새로 선택된 값에 해당하는 플래그만 다시 세팅하는 방식으로 "상호 배타적" 조건을 구현.
                  const clone = {
                    ...dateColorKey,
                  };
                  delete clone.isAfter;
                  delete clone.isBefore;
                  delete clone.isToday;

                  switch ((e.target as HTMLSelectElement).value) {
                    case 'today':
                      clone.isToday = true;
                      break;
                    case 'before':
                      clone.isBefore = true;
                      break;
                    case 'after':
                      clone.isAfter = true;
                      break;
                    // 'between'인 경우는 플래그를 하나도 세우지 않고, 아래의 distance/unit/direction
                    // 입력값으로 조건을 표현한다.
                  }

                  updateKey(clone);
                }}
              >
                <option value="between">{t('Between now and')}</option>
                <option value="today">{t('Today')}</option>
                <option value="after">{t('After now')}</option>
                <option value="before">{t('Before now')}</option>
              </select>
              {/* "between" 조건(오늘/이전/이후 플래그가 모두 없음)일 때만 거리(숫자)·단위·방향
                  입력창을 추가로 보여준다. */}
              {!dateColorKey.isToday && !dateColorKey.isAfter && !dateColorKey.isBefore && (
                <>
                  <input
                    type="number"
                    value={dateColorKey.distance}
                    onChange={(e) => {
                      // 기존 규칙을 복사하면서 distance 필드만 새 숫자 값으로 교체.
                      updateKey({
                        ...dateColorKey,
                        distance: parseInt((e.target as HTMLInputElement).value),
                      });
                    }}
                  />
                  <select
                    className="dropdown"
                    defaultValue={dateColorKey.unit}
                    onChange={(e) => {
                      // 시간 단위(hours/days/weeks/months)만 교체.
                      updateKey({
                        ...dateColorKey,
                        unit: (e.target as HTMLSelectElement).value as any,
                      });
                    }}
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                  <select
                    className="dropdown"
                    defaultValue={dateColorKey.direction}
                    onChange={(e) => {
                      // 방향(과거 기준/미래 기준)만 교체.
                      updateKey({
                        ...dateColorKey,
                        direction: (e.target as HTMLSelectElement).value as any,
                      });
                    }}
                  >
                    <option value="after">{t('After now')}</option>
                    <option value="before">{t('Before now')}</option>
                  </select>
                </>
              )}
            </div>

            <div className={c('date-color-config')}>
              <div>
                <div className={c('setting-item-label')}>{t('Background color')}</div>
                {/* #8(TagColorSettings.tsx)에서 만든 공용 색상 입력 위젯 재사용 */}
                <ColorPickerInput
                  color={dateColorKey.backgroundColor}
                  setColor={(color) => {
                    updateKey({
                      ...dateColorKey,
                      backgroundColor: color,
                    });
                  }}
                  defaultColor={defaultColors.backgroundColor}
                />
              </div>
              <div>
                <div className={c('setting-item-label')}>{t('Text color')}</div>
                <ColorPickerInput
                  color={dateColorKey.color}
                  setColor={(color) => {
                    updateKey({
                      ...dateColorKey,
                      color: color,
                    });
                  }}
                  defaultColor={defaultColors.color}
                />
              </div>
            </div>
          </div>
          <div>
            {/* 미리보기 영역: 실제 카드에서 쓰는 것과 동일한 CSS 클래스 구조를 재현하고,
                CSS 커스텀 프로퍼티(--date-color, --date-background-color)로 지금 설정 중인
                색을 입혀서 "오늘 날짜"를 해당 규칙 색으로 어떻게 보이는지 보여준다. */}
            <div className={c('date-color-wrapper')}>
              <div className={c('item-metadata')}>
                <span
                  style={{
                    '--date-color': dateColorKey.color,
                    '--date-background-color': dateColorKey.backgroundColor,
                  }}
                  className={classcat([
                    c('item-metadata-date-wrapper'),
                    c('date'),
                    // classcat: 조건부로 클래스명을 합성하는 유틸. 배경색이 지정된 경우에만
                    // 'has-background' 클래스를 추가해 배경 스타일이 적용되게 한다.
                    { 'has-background': !!dateColorKey?.backgroundColor },
                  ])}
                >
                  {/* moment()는 "지금 이 순간"을 나타내며, 사용자가 실제 카드에서 쓰는 포맷
                      문자열(getDateFormat/getTimeFormat)로 포맷팅해 미리보기 텍스트를 만든다. */}
                  <span className={c('item-metadata-date is-button')}>
                    {moment().format(getDateFormat())}
                  </span>{' '}
                  <span className={c('item-metadata-time is-button')}>
                    {moment().format(getTimeFormat())}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className={c('setting-button-wrapper')}>
          {/* 휴지통 아이콘 클릭 시 이 규칙을 목록에서 제거 */}
          <div className="clickable-icon" onClick={deleteKey} aria-label={t('Delete')}>
            <Icon name="lucide-trash-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface DateSettingsProps {
  dataKeys: DateColorSetting[]; // 저장되어 있던 날짜 색상 규칙 배열
  onChange: (settings: DateColorSetting[]) => void; // 목록이 바뀔 때 실제 설정에 반영하는 콜백
  portalContainer: HTMLElement;
  getTimeFormat: () => string;
  getDateFormat: () => string;
}

// 날짜 색상 규칙 목록 전체를 관리하는 최상위 컴포넌트 (TagSettings와 구조가 매우 유사하다).
function DateSettings({ dataKeys, onChange, getTimeFormat, getDateFormat }: DateSettingsProps) {
  // keys: 화면에 렌더링 중인 규칙 배열의 로컬 상태. Preact.useState는 preact/compat이 제공하는
  // React 호환 훅으로, 위에서 개별 import 대신 네임스페이스(Preact.*)로 접근하고 있다.
  const [keys, setKeys] = Preact.useState(dataKeys);
  // defaultColors 역시 #8과 동일한 기법: 화면에 보이지 않는 더미 날짜 엘리먼트를 만들어
  // getComputedStyle로 테마의 기본 글자색/배경색을 읽어온 뒤 즉시 제거한다. useMemo로
  // 마운트 시 한 번만 계산해 재사용한다.
  const defaultColors = Preact.useMemo(() => {
    const wrapper = createDiv(c('item-metadata'));
    const date = wrapper.createSpan(c('item-metadata-date'));

    wrapper.style.position = 'absolute';
    wrapper.style.visibility = 'hidden';

    activeDocument.body.append(wrapper);

    const props = activeWindow.getComputedStyle(date);
    const color = props.getPropertyValue('color').trim();
    const backgroundColor = props.getPropertyValue('background-color').trim();

    wrapper.remove();

    return {
      color,
      backgroundColor,
    };
  }, []);

  // 부모(onChange, 실제 저장)와 로컬 상태(setKeys, 화면 갱신)를 함께 갱신하는 공통 헬퍼.
  const updateKeys = (keys: DateColorSetting[]) => {
    onChange(keys);
    setKeys(keys);
  };

  // "날짜 색상 추가" 버튼 클릭 시: 기본값(오늘 아님, 거리 1, 단위 days, 방향 after)을 가진
  // 새 규칙을 배열 끝에 추가한다.
  const newKey = () => {
    updateKeys(
      // $push: [item] → 배열 끝에 새 항목을 추가한 새 배열을 만든다(원본은 불변 유지).
      update(keys, {
        $push: [
          {
            ...DateColorSettingTemplate,
            id: generateInstanceId(), // 각 규칙을 구분하는 고유 id(Preact key prop용)
            data: {
              isToday: false,
              distance: 1,
              unit: 'days',
              direction: 'after',
            },
          },
        ],
      })
    );
  };

  // 인덱스 i번 규칙을 삭제.
  const deleteKey = (i: number) => {
    updateKeys(
      // $splice: [[i, 1]] → i번 위치에서 1개 원소 제거(불변 버전의 Array.splice).
      update(keys, {
        $splice: [[i, 1]],
      })
    );
  };

  // 커링 형태: updateDateColor(i)를 호출하면 "i번째 규칙 전체(data)를 교체하는 함수"가 나온다.
  // TagColorSettings의 updateTagColor와 달리 필드별이 아니라 data 객체 전체를 한 번에 $set한다
  // (Item 내부에서 이미 ...dateColorKey로 스프레드해 완성된 새 객체를 넘겨주기 때문).
  const updateDateColor = (i: number) => (newDateKey: DateColor) => {
    updateKeys(
      update(keys, {
        [i]: {
          data: {
            $set: newDateKey,
          },
        },
      })
    );
  };

  return (
    <div className={c('date-color-input-wrapper')}>
      <div className="setting-item-info">
        <div className="setting-item-name">{t('Display date colors')}</div>
        <div className="setting-item-description">
          {t('Set colors for dates displayed in cards based on the rules below.')}
        </div>
      </div>
      <div>
        {/* 규칙 배열을 Item 행으로 매핑. key={key.id}로 Preact가 각 행을 안정적으로 추적하게 한다. */}
        {keys.map((key, index) => (
          <Item
            key={key.id}
            dateColorKey={key.data}
            deleteKey={() => deleteKey(index)}
            updateKey={updateDateColor(index)}
            defaultColors={defaultColors}
            getTimeFormat={getTimeFormat}
            getDateFormat={getDateFormat}
          />
        ))}
      </div>
      <button className={c('add-tag-color-button')} onClick={newKey}>
        {t('Add date color')}
      </button>
    </div>
  );
}

// Obsidian 설정 화면의 순수 DOM 컨테이너에 이 Preact 트리를 마운트하는 진입점.
// SettingsModal이 보드 설정 탭을 그릴 때 호출한다.
export function renderDateSettings(
  containerEl: HTMLElement,
  keys: DateColorSetting[],
  onChange: (key: DateColorSetting[]) => void,
  getDateFormat: () => string,
  getTimeFormat: () => string
) {
  Preact.render(
    <DateSettings
      dataKeys={keys}
      onChange={onChange}
      portalContainer={getParentBodyElement(containerEl)}
      getDateFormat={getDateFormat}
      getTimeFormat={getTimeFormat}
    />,
    containerEl
  );
}

// 설정 탭이 닫히거나 전환될 때 Preact 컴포넌트를 컨테이너에서 언마운트(정리)한다.
export function cleanUpDateSettings(containerEl: HTMLElement) {
  Preact.unmountComponentAtNode(containerEl);
}
