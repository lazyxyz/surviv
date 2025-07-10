// @ts-expect-error kenis
import language from "../languages/english"
import { stringify } from "hjson"
import { writeFileSync } from "fs"

writeFileSync("../languages/en.hjson", stringify(language, {
  quotes: "all"
}))
