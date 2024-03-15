// 한국어

export default {
    // main.ts
    'Open as kanban board': '칸반 보드로 열기',
    'Create new board': '새 보드 만들기',
    'Archive completed cards in active board':
        '활성 보드에서 완료된 카드 보관',
    'Error: current file is not a Kanban board':
        '에러: 현재 파일은 칸반 보드가 아닙니다.',
    'Convert empty note to Kanban': '빈 노트를 칸반 보드로 변환',
    'Error: cannot create Kanban, the current note is not empty':
        '에러: 칸반을 생성할 수 없습니다. 현재 노트가 비어있지 않습니다.',
    'New kanban board': '새 보드 만들기',
    'Untitled Kanban': '이름 없는 보드',
    'Toggle between Kanban and markdown mode':
        '칸반 모드와 마크다운 모드 전환',

    // KanbanView.tsx
    'Open as markdown': '마크다운으로 열기',
    'Open board settings': '보드 설정 열기',
    'Archive completed cards': '완료된 카드 보관',
    'Something went wrong': '알 수 없는 문제가 발생했습니다.',
    'You may wish to open as markdown and inspect or edit the file.':
        '마크다운으로 열어 파일을 검사하거나 편집할 수 있습니다.',
    'Are you sure you want to archive all completed cards on this board?':
        '정말 이 보드의 모든 완료된 카드를 보관하시겠습니까?',

    // parser.ts
    Complete: '완료됨',
    Archive: '보관됨',
    'Invalid Kanban file: problems parsing frontmatter':
        '잘못된 칸반 파일: 프론트매터 파싱 문제가 발생했습니다.',
    "I don't know how to interpret this line:":
        "이 줄을 해석할 수 없습니다:",
    Untitled: '제목 없음', // auto-created column

    // settingHelpers.ts
    'Note: No template plugins are currently enabled.':
        '노트: 현재 템플릿 플러그인이 활성화되어 있지 않습니다.',
    default: '기본',
    'Search...': '검색하기...',

    // Settings.ts
    'New line trigger': '새 줄 만들기',
    'Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.':
        'Enter 또는 Shift + Enter 중 어느 단축키로 새 줄로 넘어갈지 선택합니다. 선택하지 않은 단축키 (만약 Enter를 선택했다면 Shift + Enter) 는 진행중인 카드 또는 목록의 생성 및 수정을 완료합니다.',
    'Shift + Enter': 'Shift + Enter',
    Enter: 'Enter',
    'Prepend / append new cards': '새로운 카드를 추가할 위치',
    'This setting controls whether new cards are added to the beginning or end of the list.':
        '새로운 카드를 추가하는 버튼이 맨 위에 추가될지 맨 아래에 추가될지 설정합니다.',
    Prepend: '상단',
    'Prepend (compact)': '상단 (작은 버튼)',
    Append: '하단',
    'These settings will take precedence over the default Kanban board settings.':
        '이 설정은 기본 칸반 보드 설정보다 우선합니다.',
    'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.':
        '기본 칸반 보드 설정을 설정합니다. 설정은 보드별로 재정의할 수 있습니다.',
    'Note template': '노트 템플릿',
    'This template will be used when creating new notes from Kanban cards.':
        '이 템플릿은 칸반 카드에서 새 노트를 만들 때 사용됩니다.',
    'No template': '템플릿 없음',
    'Note folder': '노트 폴더',
    'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.':
        '카드에서 만든 노트는 이 폴더에 저장됩니다. 만약 비어있다면, 기본 위치에 저장됩니다.',
    'Default folder': '기본 폴더',
    'List width': '목록 너비',
    'Enter a number to set the list width in pixels.':
        '픽셀 단위로 목록의 너비를 설정합니다.',
    'Maximum number of archived cards': '보관된 카드의 최대 수',
    "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
        "보관된 카드는 마크다운 모드에서 볼 수 있습니다. 이 설정은 한도에 도달하면 이전 카드를 제거하기 시작합니다. 이 값을 -1로 설정하면 보관함이 무한정으로 커질 수 있습니다.",
    'Display card checkbox': '카드에 체크박스 표시',
    'When toggled, a checkbox will be displayed with each card':
        '활성화하면 각 카드에 체크박스가 표시됩니다.',
    'Reset to default': '기본값으로 초기화',
    'Date & Time': '날짜 및 시간',
    'Date trigger': '날짜 선택기 트리거',
    'When this is typed, it will trigger the date selector':
        '이 텍스트를 입력하면 날짜 선택기가 표시됩니다.',
    'Time trigger': '시간 선택기 트리거',
    'When this is typed, it will trigger the time selector':
        '이 텍스트를 입력하면 시간 선택기가 표시됩니다.',
    'Date format': '날짜 형식',
    'This format will be used when saving dates in markdown.':
        '이 형식은 마크다운에서 날짜를 저장할 때 사용됩니다.',
    'For more syntax, refer to': '자세한 문법은 다음을 참조하세요.',
    'format reference': '형식 참조',
    'Your current syntax looks like this': '현재 문법은 다음과 같습니다.',
    'Time format': '시간 형식',
    'Date display format': '날짜 표시 형식',
    'This format will be used when displaying dates in Kanban cards.':
        '이 형식은 카반 보드에서 날짜를 표시할때 사용됩니다.',
    'Show relative date': '날짜를 상대적으로 표시',
    "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'":
        "활성화하면 '3일 후', '한달 전' 처럼 오늘과 설정된 날짜 사이의 거리로 표기합니다.",
    'Hide card display dates': '카드 날짜 표시 숨기기',
    'Hide card counts in list titles': '목록 제목에 카드 수 표시 숨기기',
    'When toggled, card counts are hidden from the list title':
        '활성화하면 목록 제목에 총 카드 수가 표시되지 않습니다.',
    'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.':
        '활성화하면 카드에 날짜가 표시되지 않습니다. 상대적인 날짜는 활성화되어 있다면 표시됩니다.',
    'Hide dates in card titles': '카드 제목에 날짜 숨기기',
    'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.':
        '활성화하면 카드 제목에 날짜가 표시되지 않습니다. 새 노트를 만들 때 제목에 날짜가 포함되는 것을 방지합니다.',
    'Link dates to daily notes': '일일 노트에 날짜 연결',
    'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]':
        '활성화하면 날짜가 일일 노트에 연결됩니다. 예: [[2021-04-26]]',
    'Add date and time to archived cards': '보관된 카드에 날짜와 시간 추가',
    'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title':
        '활성화하면 카드가 보관될 때 현재 날짜와 시간이 카드 제목에 추가됩니다. 예: - [ ] 2021-05-14 10:00am 내 카드 제목',
    'Add archive date/time after card title':
        '카드 제목 뒤에 보관된 날짜/시간 추가',
    'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.':
        '활성화하면 카드 제목 뒤에 보관된 날짜/시간이 추가됩니다. 예: - [ ] 내 카드 제목 2021-05-14 10:00am. 기본적으로 제목 앞에 삽입됩니다.',
    'Archive date/time separator': '보관될 카드의 날짜/시간 구분자',
    'This will be used to separate the archived date/time from the title':
        '이 구분자는 카드 제목과 보관된 날짜/시간을 구분하는데 사용됩니다.',
    'Archive date/time format': '보관된 카드의 날짜/시간 형식',
    'Kanban Plugin': '칸반 플러그인',
    'Hide tags in card titles': '카드 제목에 태그 숨기기',
    'When toggled, tags will be hidden card titles. This will prevent tags from being included in the title when creating new notes.':
        '활성화하면 카드 제목에 태그가 표시되지 않습니다. 새 노트를 만들 때 제목에 태그가 포함되는 것을 방지합니다.',
    'Hide card display tags': '카드 태그 숨기기',
    'When toggled, tags will not be displayed below the card title.':
        '활성화하면 카드 제목 아래에 태그가 표시되지 않습니다.',
    'Display tag colors': '태그 색상 표시',
    'Set colors for the tags displayed below the card title.':
        '카드 제목 아래에 표시되는 태그의 색상을 설정합니다.',
    'Linked Page Metadata': '링크된 페이지 메타데이터',
    'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.':
        '카드 내에서 첫 번째로 링크된 노트의 메타데이터를 표시합니다. 아래에 표시할 메타데이터 키를 지정합니다. 선택적으로 레이블을 제공할 수 있으며, 레이블을 완전히 숨길 수 있습니다.',
    'Board Header Buttons': '보드 헤더 버튼',
    'Calendar: first day of week': '달력: 첫 번째 요일',
    'Override which day is used as the start of the week':
        '한 주의 시작으로 사용되는 요일을 재정의합니다.',
    'Hide task counter in card titles': '카드 제목에 작업 카운터 숨기기',
    'When toggled, this will hide the number of tasks total and completed in the card.':
        '이 옵션을 켜면 카드에서 총 작업 수와 완료된 작업 수가 숨겨집니다.',
    Sunday: '일요일',
    Monday: '월요일',
    Tuesday: '화요일',
    Wednesday: '수요일',
    Thursday: '목요일',
    Friday: '금요일',
    Saturday: '토요일',
    'Background color': '배경 색상',
    Tag: '태그',
    'Text color': '글자 색상',
    'Date is': '날짜는',
    Today: '오늘',
    'After now': '이후',
    'Before now': '이전',
    'Between now and': '과의 사이',
    'Display date colors': '날짜 색상 표시',
    'Set colors for the date displayed below the card based on the rules below':
        '아래 카드에 표시된 날짜의 색상을 아래의 규칙에 따라 설정하세요.',
    'Add date color': '날짜 색상 추가',

    // MetadataSettings.tsx
    'Metadata key': '메타데이터 키',
    'Display label': '표시될 라벨',
    'Hide label': '라벨 숨기기',
    'Drag to rearrange': '드래그하여 재정렬',
    Delete: '삭제',
    'Add key': '키 추가',
    'Field contains markdown': '필드에 마크다운이 포함되어 있습니다.',

    // TagColorSettings.tsx
    'Add tag color': '태그 색상 추가',

    // components/Item/Item.tsx
    'More options': '더 많은 옵션',
    Cancel: '취소',

    // components/Item/ItemContent.tsx
    today: '오늘',
    yesterday: '어제',
    tomorrow: '내일',
    'Change date': '날짜 변경',
    'Change time': '시간 변경',

    // components/Item/ItemForm.tsx
    'Card title...': '카드 제목...',
    'Add card': '카드 추가',
    'Add a card': '카드 추가',

    // components/Item/ItemMenu.ts
    'Edit card': '카드 수정',
    'New note from card': '카드에서 새 노트 만들기',
    'Archive card': '카드 보관',
    'Delete card': '카드 삭제',
    'Edit date': '날짜 수정',
    'Add date': '날짜 추가',
    'Remove date': '날짜 삭제',
    'Edit time': '시간 수정',
    'Add time': '시간 추가',
    'Remove time': '시간 삭제',
    'Duplicate card': '카드 복제',
    'Split card': '카드 분할',
    'Copy link to card': '카드 링크 복사',
    'Insert card before': '카드 위에 삽입',
    'Insert card after': '카드 아래에 삽입',
    'Add label': '라벨 추가',
    'Move to top': '맨 위로 이동',
    'Move to bottom': '맨 아래로 이동',

    // components/Lane/LaneForm.tsx
    'Enter list title...': '목록 제목 입력...',
    'Mark cards in this list as complete': '이 목록의 카드를 완료됨으로 표시',
    'Add list': '목록 추가',
    'Add a list': '목록 추가',

    // components/Lane/LaneHeader.tsx
    'Move list': '목록 이동',
    Close: '닫기',

    // components/Lane/LaneMenu.tsx
    'Are you sure you want to delete this list and all its cards?':
        '정말로 이 목록과 그 안의 모든 카드를 삭제하시겠습니까?',
    'Yes, delete list': '네, 목록을 삭제합니다.',
    'Are you sure you want to archive this list and all its cards?':
        '정말로 이 목록과 그 안의 모든 카드를 보관하시겠습니까?',
    'Yes, archive list': '네, 모두 보관합니다.',
    'Are you sure you want to archive all cards in this list?':
        '정말로 이 목록의 모든 카드를 보관하시겠습니까?',
    'Yes, archive cards': '네, 모두 보관합니다.',
    'Edit list': '목록 수정',
    'Archive cards': '카드 보관',
    'Archive list': '목록 보관',
    'Delete list': '목록 삭제',
    'Insert list before': '목록을 왼쪽에 생성',
    'Insert list after': '목록을 오른쪽에 생성',
    'Sort by card text': '내용으로 정렬',
    'Sort by date': '날짜순으로 정렬',

    // components/helpers/renderMarkdown.ts
    'Unable to find': '찾을 수 없습니다.',
    'Open in default app': '기본 앱으로 열기',

    // components/Editor/MarkdownEditor.tsx
    Submit: '확인',
};
