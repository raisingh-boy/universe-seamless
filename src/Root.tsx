import { Composition } from "remotion";
import { KnowledgeUniverse } from "./KnowledgeUniverse";
import { seamlessGraph } from "./graph-data";

export const Root = () => {
  return (
    <Composition
      id="KnowledgeJourney"
      component={KnowledgeUniverse}
      durationInFrames={600}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        graph: seamlessGraph,
        durationInFrames: 600,
      }}
    />
  );
};
