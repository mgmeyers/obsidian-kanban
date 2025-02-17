import { Sortable } from "../dnd/components/Sortable";
import { Lanes } from "./Lane/Lane";
import { c } from "./helpers";

interface Props {
    title: string;
    lanes: any[];
    axis: "horizontal" | "vertical";
}

const Swimlane = ({ title, lanes, axis }: Props) => {
  return (
      <div className={c("swimlane")}>
          <div className={c("swimlane-header")}>{title}</div>
          <div className={c("swimlane-content")}>
              <Sortable axis={axis}>
                  <Lanes lanes={lanes} collapseDir={axis} />
              </Sortable>
          </div>
      </div>
  )
};

export default Swimlane;
