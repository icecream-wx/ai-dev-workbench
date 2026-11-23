import { debounce } from 'lodash'

export default {
  data() {
    return {
      mousemoveHandler: null,
      resize: {
        card: null,
        direction: 'left',
        benchmarkDay: null,
        lastDateString: null,
      },
    };
  },
  mounted() {
    this.addListener();
  },
  beforeUnmount() {
    this.removeListener();
  },
  methods: {
    addListener() {
      window.addEventListener("mousedown", this.handleMousedownResize);
      window.addEventListener("mouseup", this.handleMouseupResize);
    },
    removeListener() {
      window.removeEventListener("mousedown", this.handleMousedownResize);
      window.removeEventListener("mouseup", this.handleMouseupResize);
    },
    findResizingCardId(e) {
      const cardNode = e.target.parentNode;
      const cardClassName = Array.from(cardNode.classList).find((className) => className.startsWith("card-item-"));
      const cardId = cardClassName.split("card-item-")[1].toString();
      return cardId;
    },
    findMouseHoverDay(e, list = []) {
      const dayItemSet = document.querySelectorAll(".day-item");
      let nodeHoveredDay = null;
      for (const dayItem of dayItemSet) {
        const rect = dayItem.getBoundingClientRect();
        const insideDayItem =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (insideDayItem) {
          nodeHoveredDay = dayItem;
          break;
        }
      }
      if(!nodeHoveredDay) return null
      const dayClassName = Array.from(nodeHoveredDay.classList).find(
        (className) => className.startsWith("day-item-")
      );
      const dayId = dayClassName.split("day-item-")[1];
      const mouseHoverDay = list.find(({ id }) => id.toString() === dayId);
      return mouseHoverDay;
    },
    findCardFromDay(e, list = []) {
      const cardNode = e.target.parentNode;
      const cardFromDayNode = cardNode.parentNode.parentNode.parentNode;
      const cardFromDayClassName = Array.from(cardFromDayNode.classList).find((className) => className.startsWith("day-item-"));
      const cardFromDayId = cardFromDayClassName.split("day-item-")[1];
      const cardFromDay = list.find(({ id }) => id.toString() === cardFromDayId);
      return cardFromDay;
    },
    handleMousedownResize(e) {
      const isResize = e.target.classList.contains("resize");
      if (!isResize) return;
      this.mousemoveHandler = debounce(this.handleMousemoveResize, 50);
      window.addEventListener("mousemove", this.mousemoveHandler);

      const resizingCardId = this.findResizingCardId(e);
      const mouseHoverDay = this.findMouseHoverDay(e, this.dateListInner);
      const cardFromDay = this.findCardFromDay(e, this.dateListInner);

      this.resize.card = cardFromDay.cardList.find((item) => item[this.pkField].toString() === resizingCardId);
      this.resize.direction = e.target.classList.contains("left-resize") ? "left" : "right";
      const { [this.startField]: start, [this.endField]: end } = this.resize.card
      this.resize.benchmarkDay = this.resize.direction === "left" ? end.value : start.value;
      this.resize.lastDateString = mouseHoverDay.dateString;
    },
    handleMousemoveResize(e) {
      const { card, direction, benchmarkDay, lastDateString } = this.resize;
      const mouseHoverDay = this.findMouseHoverDay(e, this.dateListInner);
      if(!mouseHoverDay) return
      const sameWithLastMousemoveDate = mouseHoverDay.dateString === lastDateString;
      if (sameWithLastMousemoveDate) return;

      this.resize.lastDateString = mouseHoverDay.dateString;
      let resizePos;
      const dragFromLeft = direction === "left";
      const dragFromRight = direction === "right";
      const beforeBenchmarkDay = mouseHoverDay.date.isBefore(benchmarkDay, "day");
      const sameWithBenchmarkDay = mouseHoverDay.date.isSame(benchmarkDay, "day");
      const afterBenchmarkDay = mouseHoverDay.date.isAfter(benchmarkDay, "day");
      const updateCardStart =
        (dragFromLeft && (beforeBenchmarkDay || sameWithBenchmarkDay)) ||
        (dragFromRight && beforeBenchmarkDay);
      const updateCardEnd =
        (dragFromRight && (afterBenchmarkDay || sameWithBenchmarkDay)) ||
        (dragFromLeft && afterBenchmarkDay);
      if (updateCardStart) resizePos = "start";
      if (updateCardEnd) resizePos = "end";
      this.$emit("resizeCard", {
        day: mouseHoverDay,
        card,
        resizePos,
        direction,
        benchmarkDay,
      });
    },
    handleMouseupResize(e) {
      if(!this.mousemoveHandler) return
      window.removeEventListener("mousemove", this.mousemoveHandler);
      this.mousemoveHandler = null
    },
  },
}
