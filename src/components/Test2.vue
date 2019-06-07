<template>
  <div :class="$style.ccd">
    6666
  </div>
</template>

<script>

export default {
  name: 'HelloWorld'
}
</script>

<style lang="less">
.box {
  color: "#777";
}
</style>

<style lang="less" module>
@import "./test.less";
.ccd {
  color: #000;
  background: @primary-color;
  width: 100px;
}
</style>
