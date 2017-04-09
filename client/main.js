import Papa from 'papaparse';
import _ from 'lodash';
import math from 'mathjs';

Samples = new Mongo.Collection(null);

let d3 = Plotly.d3;

Template.graph.helpers({
  samples: function(){
    return Samples.find();
  },
  format: function(value){
    return math.format(value, {
      notation: "engineering"
    })
  }
});

Template.graph.events({
  "focusout .extcoeff": function(event){
    console.log(event.currentTarget.value);

    let extcoeff = parseFloat(event.currentTarget.value);

    let concentration = [];
    for(let i=0; i<this.absorbance.length; i++){
      concentration.push(this.absorbance[i]/extcoeff);
    }
    let mean = math.mean(concentration);
    let deviation = math.std(concentration);

    Samples.update(this._id, {
      $set: {
        extcoeff: extcoeff,
        mean: mean,
        deviation: deviation
      }
    })
  },
  "click #download-csv": function(){
    let csv = "Sample,Concentration,Deviation\n";
    Samples.find().forEach(function(sample){
      csv += sample.name+","+sample.mean+","+sample.deviation+"\n";
    });
    download("data.csv", csv);
  },
  "click #download-svg": function(){
    download("data.svg", $(".main-svg")[0].outerHTML.slice(0, -6)+$(".main-svg")[1].innerHTML+"</svg>");
  }
})

Meteor.startup(function(){

  $('input[type=file]').on("change", function(){

    $('input[type=file]').parse({
    	config: {
        dynamicTyping: true,
    		complete: function(results, file){
          handleResults(results);
        }
    	}
    });

  })

  Tracker.autorun(function(){
    let samples = Samples.find().fetch();
    let names = _.map(samples, "name").reverse();
    let concentrations = _.map(samples, "mean").reverse();
    let deviations = _.map(samples, "deviation").reverse();

    $("#tester").height(samples.length*50);

    let data = [{
      type: 'bar',
      x: concentrations,
      y: names,
      orientation: 'h',
      error_x: {
        type: "data",
        array: deviations,
        visible: true
      }
    }];

    let layout = {
      annotations: [],
      xaxis: {
        title: "Concentration [M]"
      }
    };

    for( let i = 0 ; i < samples.length; i++ ){
      let result = {
        x: 0.01,
        y: names[i],
        text: d3.format(".4s")(concentrations[i])+"±"+d3.format(".4s")(deviations[i]),
        xanchor: 'left',
        yanchor: 'center',
        xref: "paper",
        showarrow: false,
        font: {
          color: "#fff"
        }
      };
      layout.annotations.push(result);
    }


    let targetDiv = document.getElementById('tester')
    Plotly.newPlot(targetDiv, data, layout).then( function() {
      layout.margin = calculateLegendMargins(targetDiv);
      Plotly.relayout(targetDiv,layout);
    });
  });


});

function download(filename, text, dataType="text/plain") {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:'+dataType+';charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function calculateLegendMargins(containingElement){
  var legendBB = $(containingElement).find(".yaxislayer")[0].getBBox();
  var legendYY = $(containingElement).find(".xaxislayer")[0].getBBox();

  var margin = {
    t: 30,
    r: 30
  };
  margin.l = legendBB.width+30;
  margin.b = legendYY.height+30;
  return margin;
}

function handleResults(results){

  for(let n=1, len = results.data.length-1; n<len; n++){
    let result = results.data[n];

    Samples.update({
      name: result[1]
    }, {
      $push: {
        absorbance: result[5]
      }
    }, {
      upsert: true
    });
  }

}
