document.getElementById("channel").addEventListener("change", onChannelChanged);
function onChannelChanged(evt) {
  location.hash = evt.target.value;
  main();
}

var versions = {};

function codeToName(code) {
  return (isoLangs[code] || { name: code }).name;
}
var bar;
function populateTopLangs(rawStats) {
  stats = rawStats.slice();
  stats.sort((a, b) => a.rmCount - b.rmCount);
  stats = stats.slice(stats.length - 16);
  let data = {
    labels: stats.map(s => `${s.label}`),
    series: [
      {
        name: "Narrate Supported",
        data: stats.map(s => {
          return {
            value: s.nSuccess,
            meta: (s.nSuccess * 100 / s.rmCount).toFixed(2) +
              "% Narrate supported"
          };
        })
      },
      {
        name: "Narrate Unsupported",
        data: stats.map(s => {
          return {
            value: s.nFail,
            meta: (s.nFail * 100 / s.rmCount).toFixed(2) +
              "% Narrate unsupported"
          };
        })
      }
    ]
  };

  new Chartist.Bar("#topLangs", data, {
    horizontalBars: true,
    reverseData: false,
    stackBars: true,
    axisX: {
      labelInterpolationFnc: function(value) {
        return value / 1000 + "k";
      }
    },
    axisY: { position: "end" },
    plugins: [
      Chartist.plugins.tooltip(),
      Chartist.plugins.ctAccessibility({
        caption: "Reader Mode content language distribution",
        seriesHeader: "",
        summary: "The first row is the success count for initializing Narrate, the second row is the failure count"
      })
    ]
  }).on("draw", function(data) {
    if (data.type === "bar") {
      data.element.attr({ style: "stroke-width: 15px" });
    }
  });
}

function populateFailedLangs(stats, cutoff = 14) {
  let pieData = stats.slice().sort((a, b) => b.nFail - a.nFail);
  let other = pieData.slice(cutoff).reduce((a, b) => {
    return {
      label: a.label,
      nFail: a.nFail + b.nFail,
      nFailShare: a.nFailShare + b.nFailShare
    };
  }, { label: "Other", nFail: 0, nFailShare: 0 });
  pieData.splice(cutoff, pieData.length - cutoff, other);

  let data = {
    labels: pieData.map(
      l => `${l.label} (${(l.nFailShare * 100).toFixed(1)}%)`
    ),
    series: pieData.map(l => l.nFail)
  };
  var options = {
    plugins: [
      Chartist.plugins.ctAccessibility({
        caption: "Distribution of most underserved languages",
        seriesHeader: "",
        summary: ""
      })
    ],
    width: "80%",
    height: "80%"
  };
  var responsiveOptions = [
    [
      "screen and (min-width: 640px)",
      {
        //chartPadding: 30,
        //labelOffset: -10,
        labelPosition: "outside",
        labelDirection: "explode",
        labelInterpolationFnc: function(value) {
          return value;
        }
      }
    ],
    [
      "screen and (min-width: 1024px)",
      { labelOffset: 120, labelDirection: "explode", chartPadding: 20 }
    ]
  ];

  new Chartist.Pie("#topFails", data, options, responsiveOptions);
}

function hd(v) {
  return humanizeDuration(v, { round: true });
}

function populateNarrateSpeakTime(stats) {
  let series = stats.values.slice(1);
  let labels = stats.buckets.slice(1);
  let total = series.reduce((a, b) => a + b);
  let data = {
    labels,
    series: [
      series.map((v, i) => {
        return { value: v / total * 100,
          meta: i == 0 ? "Under 11 seconds" : "Over " + hd(labels[i]) };
      })
    ]
  };

  new Chartist.Bar("#narrateSpeakTime", data, {
    reverseData: false,
    axisX: {
      labelInterpolationFnc: function(v) {
        if (v == 300000) {
          return "5:00+";
        }
        let seconds = Math.round(v / 1000);
        if (seconds && seconds % 5 == 0) {
          return `${new Date(v).toLocaleFormat("%M:%S")}`;
        }
        return null;
      }
    },
    axisY: {
      labelInterpolationFnc: function(v) {
        return `${v.toFixed(0)}%`;
      }
    },
    plugins: [
      Chartist.plugins.tooltip({
        transformTooltipTextFnc: v => {
          return `${Number(v).toFixed(2)}%`;
        }
      }),
      Chartist.plugins.ctAccessibility({
        caption: "Reader Mode Speaking Times",
        seriesHeader: "",
        summary: ""
      })
    ]
  }).on("draw", function(data) {
    if (data.type === "bar") {
      data.element.attr({ style: "stroke-width: 15px" });
    }
  });
}

function populateSummary(channel, version, rmStats, nStats) {
  function setText(id, text) {
    document.getElementById(id).textContent = text;
  }

  let channelName = document.getElementById("channel").selectedOptions[0].textContent;
  setText("channelName", channelName);
  setText("version", version);

  let rmUsageTotal = rmStats.reduce((a, b) => a + b.rmCount, 0);
  setText("rmUsageTotal", rmUsageTotal.toLocaleString());

  let rmTopLang = rmStats.reduce(
    (a, b) => a.rmShare > b.rmShare ? a : b, { rmShare: 0 });
  setText("rmTopLang", rmTopLang.label);

  let nSuccessRate = rmStats.reduce((a, b) => a + b.nSuccess, 0)/rmUsageTotal;
  setText("nSuccessRate", (nSuccessRate*100).toFixed(1) + "%");

  let nMostFailedLang = rmStats.reduce(
    (a, b) => a.nFail > b.nFail ? a : b, { rmShare: 0 });
  setText("nMostFailedLang", nMostFailedLang.label);

  let nUsageTotal = nStats.values.reduce((a, b) => a + b);
  setText("nUsageTotal", nStats.count.toLocaleString());

  let nUnderSecondShare = (nStats.values[0] + nStats.values[1])/nUsageTotal;
  setText("nUnderSecondShare", (nUnderSecondShare*100).toFixed(1) + "%");

  let nOverMinuteShare = nStats.values.slice(6).reduce((a, b) => a + b)/nUsageTotal;
  setText("nOverMinuteShare", (nOverMinuteShare*100).toFixed(1) + "%");
}

function currentVersions() {
  var nightly = Number(
    Telemetry
      .getVersions()
      .filter(version => version.startsWith("nightly"))
      .map(versionString => versionString.split("/")[(1)])
      .sort((a, b) => a - b)
      .pop()
  );
  return {
    nightly: nightly + "",
    aurora: nightly - 1 + "",
    beta: nightly - 2 + "",
    release: nightly - 3 + ""
  };
}

function evolutionToStats(evolution) {
  let entries = Object.entries(evolution);
  let totalReaderUsage = entries.reduce(
    (a, b) => {
      return a + b[(1)].histogram().values[(0)];
    },
    0
  );
  let totalnFails = entries.reduce(
    (a, b) => {
      let h = b[(1)].histogram();
      return a + (h.values[(0)] - h.values[(1)]);
    },
    0
  );

  return entries.map(([ lang, val ]) => {
    let values = val.histogram().values;
    let rmCount = values[(0)];
    let rmShare = values[(0)] / totalReaderUsage;
    let nSuccess = values[(1)];
    let nFail = values[(0)] - values[(1)];
    let nFailShare = nFail / totalnFails;
    let label = codeToName(lang);
    return {
      lang,
      label,
      rmCount,
      rmShare,
      nSuccess,
      nFail,
      nFailShare
    };
  });
}

function statsToCSV(stats) {
  let keys = [ "lang", "rmCount", "nFail" ];
  return keys.map(k => JSON.stringify(k)).join(",") + "\n" + stats.map(stat => {
      return keys.map(k => JSON.stringify(stat[k])).join(",");
    }).join("\n");
}

let initPromise = new Promise(resolve => {
  Telemetry.init(resolve);
});

function getEvolution(channel, version, metric) {
  return new Promise(resolve => {
    Telemetry.getEvolution(channel, version, metric, {}, false, resolve);
  });
}

function main() {
  document.body.classList.add("loading");
  var channel = location.hash
    ? location.hash.substr(1)
    : document.getElementById("channel").value;
  initPromise.then(() => {
    var version = currentVersions()[channel];
    Promise
      .all([
        getEvolution(channel, version, "NARRATE_CONTENT_BY_LANGUAGE_2"),
        getEvolution(channel, version, "NARRATE_CONTENT_SPEAKTIME_MS")
      ])
      .then(([ evoLang, evoSpeakTime ]) => {
        document.body.classList.remove("loading");

        let rmStats = evolutionToStats(evoLang);
        let nStats = evoSpeakTime[""].histogram();
        let csvlink = document.getElementById("csvlink");
        csvlink.href = "data:text/csv," + encodeURIComponent(statsToCSV(rmStats));
        populateTopLangs(rmStats);
        populateFailedLangs(rmStats);
        populateNarrateSpeakTime(nStats);
        populateSummary(channel, version, rmStats, nStats);
      });
  });
}

main();
